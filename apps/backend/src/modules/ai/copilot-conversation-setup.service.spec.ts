import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@xcash/shared-types';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CopilotContextService } from './copilot-context.service';
import { CopilotConversationService } from './copilot-conversation.service';
import { CopilotConversationSetupService } from './copilot-conversation-setup.service';

describe('CopilotConversationSetupService', () => {
  let service: CopilotConversationSetupService;
  let conversationService: {
    findOrCreate: jest.Mock;
    saveUserMessage: jest.Mock;
    getHistoryForContext: jest.Mock;
  };
  let contextService: { getFinancialContext: jest.Mock };
  let configService: { get: jest.Mock };

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    role: Role.ADMIN,
    tenantId: 'tenant-1',
    businessName: 'Test Corp',
    plan: 'starter',
  };

  const mockConversation = { id: 'conv-1', tenantId: 'tenant-1', userId: 'user-1' };
  const mockUserMsg = { id: 'msg-1', conversationId: 'conv-1', role: 'user', content: 'Hello' };

  beforeEach(async () => {
    conversationService = {
      findOrCreate: jest.fn().mockResolvedValue(mockConversation),
      saveUserMessage: jest.fn().mockResolvedValue(mockUserMsg),
      getHistoryForContext: jest
        .fn()
        .mockResolvedValue([{ role: 'assistant', content: 'Hi there' }]),
    };
    contextService = {
      getFinancialContext: jest.fn().mockResolvedValue('Tháng 7/2026: ...'),
    };
    configService = {
      get: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotConversationSetupService,
        { provide: CopilotConversationService, useValue: conversationService },
        { provide: CopilotContextService, useValue: contextService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<CopilotConversationSetupService>(CopilotConversationSetupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('prepare', () => {
    it('should create new conversation when no conversationId provided', async () => {
      const dto = { message: 'Hello', history: [] };

      const result = await service.prepare(mockUser, dto);

      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        undefined,
      );
      expect(result.isNewConv).toBe(true);
      expect(result.conversation).toEqual(mockConversation);
    });

    it('should find existing conversation when conversationId provided', async () => {
      const dto = { message: 'Hello', history: [], conversationId: 'conv-1' };

      const result = await service.prepare(mockUser, dto);

      expect(conversationService.findOrCreate).toHaveBeenCalledWith('tenant-1', 'user-1', 'conv-1');
      expect(result.isNewConv).toBe(false);
    });

    it('should save user message and return it', async () => {
      const dto = { message: 'Hello', history: [] };

      const result = await service.prepare(mockUser, dto);

      expect(conversationService.saveUserMessage).toHaveBeenCalledWith('conv-1', 'Hello');
      expect(result.userMsg).toEqual(mockUserMsg);
    });

    it('should load history from DB when conversationId provided', async () => {
      const dto = {
        message: 'Hello',
        history: [{ role: 'user' as const, content: 'old' }],
        conversationId: 'conv-1',
      };

      const result = await service.prepare(mockUser, dto);

      expect(conversationService.getHistoryForContext).toHaveBeenCalledWith('conv-1', 'msg-1');
      expect(result.history).toEqual([{ role: 'assistant', content: 'Hi there' }]);
    });

    it('should use dto.history when no conversationId (new conversation)', async () => {
      const dtoHistory = [{ role: 'user' as const, content: 'old message' }];
      const dto = { message: 'Hello', history: dtoHistory };

      const result = await service.prepare(mockUser, dto);

      expect(conversationService.getHistoryForContext).not.toHaveBeenCalled();
      expect(result.history).toEqual(dtoHistory);
    });

    it('should fetch financial context', async () => {
      const dto = { message: 'Hello', history: [] };

      const result = await service.prepare(mockUser, dto);

      expect(contextService.getFinancialContext).toHaveBeenCalledWith('tenant-1', {
        name: 'Test User',
        role: Role.ADMIN,
        businessName: 'Test Corp',
      });
      expect(result.financialContext).toBe('Tháng 7/2026: ...');
    });

    it('should respect COPILOT_USE_FUNCTION_CALLING config', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'COPILOT_USE_FUNCTION_CALLING') return false;
        return undefined;
      });

      const dto = { message: 'Hello', history: [] };
      const result = await service.prepare(mockUser, dto);

      expect(result.useFunctionCalling).toBe(false);
    });

    it('should default useFunctionCalling to false when config not set', async () => {
      configService.get.mockReturnValue(undefined);

      const dto = { message: 'Hello', history: [] };
      const result = await service.prepare(mockUser, dto);

      expect(result.useFunctionCalling).toBe(false);
    });

    it('should return tenantId from user', async () => {
      const dto = { message: 'Hello', history: [] };

      const result = await service.prepare(mockUser, dto);

      expect(result.tenantId).toBe('tenant-1');
    });
  });
});
