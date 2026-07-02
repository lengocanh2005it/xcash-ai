import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CAS_DEFAULT_GRANT_SCOPES, CasClientService } from '../cas/cas-client.service';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly casClient: CasClientService,
    private readonly configService: ConfigService,
  ) {}

  async createGrantToken(scopes = CAS_DEFAULT_GRANT_SCOPES) {
    const redirectUri = this.configService.get<string>(
      'CAS_GRANT_REDIRECT_URI',
      'http://localhost:5173/onboarding/callback',
    );

    const result = await this.casClient.createGrantToken({
      scopes,
      redirectUri,
      language: 'vi',
    });

    const linkBaseUrl = this.configService.get<string>(
      'CAS_LINK_BASE_URL',
      'https://dev.link.bankhub.dev',
    );

    return {
      grantToken: result.grantToken,
      expiresAt: result.expiresAt ?? null,
      redirectUri,
      linkBaseUrl,
    };
  }

  async handleBankingCallback(tenantId: string, publicToken: string) {
    const exchange = await this.casClient.exchangeGrant(publicToken);

    let accountNumber: string | null = null;
    let accountHolderName: string | null = null;
    let bankName: string | null = null;
    let bankLogo: string | null = null;

    try {
      const identity = await this.casClient.getIdentity(exchange.accessToken);
      ({ accountNumber, accountHolderName, bankName, bankLogo } =
        this.casClient.parseIdentity(identity));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Cas GET /identity failed for grant ${exchange.grantId}, saving grant without account metadata: ${message}`,
      );
    }

    const existingGrant = await this.prisma.casGrant.findUnique({
      where: { grantId: exchange.grantId },
    });

    if (existingGrant && existingGrant.tenantId !== tenantId) {
      throw new ConflictException('Grant đã được liên kết với tenant khác');
    }

    const grant = await this.prisma.casGrant.upsert({
      where: { grantId: exchange.grantId },
      create: {
        tenantId,
        grantId: exchange.grantId,
        accessToken: exchange.accessToken,
        accountNumber,
        accountHolderName,
        bankName,
        bankLogo,
        status: 'active',
      },
      update: {
        accessToken: exchange.accessToken,
        accountNumber,
        accountHolderName,
        bankName,
        bankLogo,
        status: 'active',
        linkedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        entityType: 'cas_grant',
        entityId: grant.id,
        action: 'banking_linked',
        actor: tenantId,
        afterState: {
          grantId: grant.grantId,
          accountNumber: grant.accountNumber,
          accountHolderName: grant.accountHolderName,
          bankName: grant.bankName,
        },
      },
    });

    return {
      grantId: grant.grantId,
      accountNumber: grant.accountNumber,
      accountHolderName: grant.accountHolderName,
      bankName: grant.bankName,
      bankLogo: grant.bankLogo,
      linkedAt: grant.linkedAt.toISOString(),
    };
  }

  async getStatus(tenantId: string) {
    const grants = await this.prisma.casGrant.findMany({
      where: { tenantId, status: 'active' },
      orderBy: { linkedAt: 'desc' },
      select: {
        id: true,
        grantId: true,
        accountNumber: true,
        accountHolderName: true,
        bankName: true,
        bankLogo: true,
        linkedAt: true,
        status: true,
      },
    });

    const bankingLinked = grants.length > 0;

    return {
      currentStep: bankingLinked ? 3 : 2,
      bankingLinked,
      grants,
      steps: [
        { id: 'register', label: 'Đăng ký tài khoản', completed: true },
        { id: 'banking', label: 'Liên kết ngân hàng', completed: bankingLinked },
        { id: 'ready', label: 'Sẵn sàng nhận giao dịch', completed: bankingLinked },
      ],
    };
  }
}
