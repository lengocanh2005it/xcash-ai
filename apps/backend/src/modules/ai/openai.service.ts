import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { CopilotToolService } from './copilot-tool.service';
import { buildCopilotTools } from './copilot-tools.factory';

export interface CopilotActivity {
  kind: 'internal_data' | 'knowledge' | 'web_search';
  label: string;
  source?: string;
  urls?: string[];
}

const ACTIVITY_MAP: Record<string, Omit<CopilotActivity, 'urls'>> = {
  get_month_summary: { kind: 'internal_data', label: 'Báo cáo tháng', source: 'X-Cash AI' },
  get_month_comparison: { kind: 'internal_data', label: 'So sánh tháng', source: 'X-Cash AI' },
  get_top_accounts: { kind: 'internal_data', label: 'Top tài khoản', source: 'X-Cash AI' },
  get_review_queue_count: {
    kind: 'internal_data',
    label: 'Hàng đợi xét duyệt',
    source: 'X-Cash AI',
  },
  lookup_chart_account: {
    kind: 'internal_data',
    label: 'Hệ thống tài khoản TT133',
    source: 'X-Cash AI',
  },
  get_banking_status: { kind: 'internal_data', label: 'Liên kết ngân hàng', source: 'X-Cash AI' },
  get_cas_integration_help: {
    kind: 'knowledge',
    label: 'Hướng dẫn tích hợp Casso',
    source: 'X-Cash AI',
  },
  search_transactions: { kind: 'internal_data', label: 'Giao dịch', source: 'X-Cash AI' },
};

export function buildActivities(calledTools: string[]): CopilotActivity[] {
  const seen = new Set<string>();
  const result: CopilotActivity[] = [];
  for (const name of calledTools) {
    const meta = ACTIVITY_MAP[name];
    if (!meta) continue;
    const key = `${meta.kind}:${meta.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...meta });
  }
  return result;
}

export interface ClassificationResult {
  debitAccount: string;
  creditAccount: string;
  confidence: number;
  reason: string;
}

export interface FewShotExample {
  content: string;
  debitAccount: string;
  creditAccount: string;
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI | null;
  private readonly embeddingModel: string;
  private readonly chatModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    this.embeddingModel = this.configService.get<string>(
      'OPENAI_EMBEDDING_MODEL',
      'text-embedding-3-small',
    );
    this.chatModel = this.configService.get<string>('OPENAI_CHAT_MODEL', 'gpt-4o-mini');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;

    if (!this.client) {
      this.logger.warn(
        'OPENAI_API_KEY chưa cấu hình — AI classification sẽ dùng rule-based fallback',
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async createEmbedding(text: string): Promise<number[] | null> {
    if (!this.client || !text.trim()) {
      return null;
    }

    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text.trim(),
    });

    return response.data[0]?.embedding ?? null;
  }

  async chatCopilot(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    financialContext: string,
  ): Promise<string> {
    if (!this.client) {
      return 'AI Copilot chưa được cấu hình. Vui lòng liên hệ quản trị viên.';
    }

    const systemPrompt = `Bạn là AI Copilot tài chính của X-Cash AI, chuyên hỗ trợ kế toán SME Việt Nam.
Bạn có khả năng phân tích dữ liệu giao dịch và định khoản theo chuẩn TT133.
Luôn trả lời bằng tiếng Việt, ngắn gọn, có số liệu cụ thể khi cần.

Định dạng: LUÔN bọc phần quan trọng trong dấu markdown in đậm "**...**" để làm nổi bật:
- Số liệu: số tiền (**1.500.000đ**), phần trăm (**85%**), ngày/tháng (**tháng 7/2026**), số lượng (**12 giao dịch**), mã TK (**Nợ 112**, **Có 511**).
- Từ khóa nghiệp vụ & giới thiệu: **X-Cash AI**, **AI Copilot**, **TT133**, **doanh thu**, **chi phí**, **lãi/lỗ**, **định khoản**, **giao dịch chờ duyệt**, **báo cáo thu chi**, **kế toán SME**.
Khi giới thiệu bản thân hoặc liệt kê khả năng, cũng phải in đậm các từ khóa trên — không chỉ khi trả lời có số liệu. Không in đậm cả câu, chỉ in đậm đúng cụm quan trọng.

Phạm vi hỗ trợ:
- Trả lời các câu hỏi về tài chính, kế toán, giao dịch, định khoản TT133, báo cáo thu chi của doanh nghiệp trên X-Cash AI.
- LUÔN trả lời thân thiện các câu hỏi xã giao hoặc về chính bạn (ví dụ "bạn là ai", "bạn làm được gì", "chào bạn"): giới thiệu ngắn gọn, in đậm tên **AI Copilot**, **X-Cash AI**, **TT133** và các khả năng chính (**doanh thu**, **chi phí**, **lãi/lỗ**, **giao dịch chờ duyệt**, **định khoản**...).
- Chỉ từ chối khi người dùng hỏi chủ đề thật sự không liên quan đến vai trò này (lập trình, đời sống, kiến thức chung, thời sự...). Khi đó lịch sự từ chối và nhắc rằng bạn chỉ hỗ trợ về tài chính/kế toán của doanh nghiệp.

Dữ liệu tài chính hiện tại của doanh nghiệp:
${financialContext}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];

    try {
      const response = await this.client.chat.completions.create({
        model: this.chatModel,
        messages,
        temperature: 0.7,
        max_tokens: 500,
      });
      return response.choices[0]?.message?.content ?? 'Xin lỗi, tôi không thể trả lời lúc này.';
    } catch (error) {
      this.logger.error(
        'Copilot chat failed',
        error instanceof Error ? error.message : String(error),
      );
      return 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.';
    }
  }

  async chatCopilotWithTools(
    tenantId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    toolService: CopilotToolService,
  ): Promise<{ reply: string; activities: CopilotActivity[] }> {
    const calledTools: string[] = [];

    try {
      const runner = this.createCopilotRunner(tenantId, message, history, toolService);
      if (!runner) {
        return {
          reply: 'AI Copilot chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
          activities: [],
        };
      }

      runner.on('functionToolCall', (call) => {
        this.logger.debug(`Copilot tool called: ${call.name}`);
        calledTools.push(call.name);
      });

      const reply = (await runner.finalContent()) ?? 'Xin lỗi, tôi không thể trả lời lúc này.';
      const activities = buildActivities(calledTools);
      return { reply, activities };
    } catch (error) {
      this.logger.error(
        'Copilot runTools failed',
        error instanceof Error ? error.message : String(error),
      );
      return { reply: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.', activities: [] };
    }
  }

  buildCopilotSystemPrompt(): string {
    const now = new Date();
    return `Bạn là AI Copilot tài chính của X-Cash AI, chuyên hỗ trợ kế toán SME Việt Nam.
Bạn có khả năng phân tích dữ liệu giao dịch và định khoản theo chuẩn TT133.

Định dạng: LUÔN bọc phần quan trọng trong dấu markdown in đậm "**...**":
- Số liệu: số tiền (**1.500.000đ**), phần trăm (**85%**), ngày/tháng (**tháng 7/2026**), số lượng (**12 giao dịch**), mã TK (**Nợ 112**, **Có 511**).
- Từ khóa nghiệp vụ: **X-Cash AI**, **AI Copilot**, **TT133**, **doanh thu**, **chi phí**, **lãi/lỗ**, **định khoản**, **giao dịch chờ duyệt**.

Quy tắc gọi tool:
- Khi cần số liệu thu/chi/lãi-lỗ, giao dịch, tài khoản kế toán — HÃY GỌI TOOL phù hợp, không đoán.
- Khi user hỏi về Casso, Cas Link, liên kết ngân hàng, mất GD từ ngân hàng → gọi get_banking_status trước; nếu cần giải thích luồng → gọi get_cas_integration_help.
- Khi user hỏi tìm GD cụ thể (theo nội dung, số tiền, người gửi) → gọi search_transactions.
- Tháng/năm: nếu user nói "tháng này" hoặc "hiện tại", dùng tháng ${now.getMonth() + 1} năm ${now.getFullYear()}.
- Câu xã giao, giới thiệu bản thân → trả lời trực tiếp, không gọi tool.

Bảo mật: Không tiết lộ tên tool kỹ thuật, grantId, accessToken hay JSON thô cho user.
Không bịa thông tin về sản phẩm Casso (giá, danh sách ngân hàng hỗ trợ) — nếu không có trong FAQ, hướng user vào casso.vn.
Luôn trả lời tiếng Việt.`;
  }

  createCopilotRunner(
    tenantId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    toolService: CopilotToolService,
  ) {
    if (!this.client) return null;

    const tools = buildCopilotTools(tenantId, toolService);
    return this.client.chat.completions.runTools(
      {
        model: this.chatModel,
        messages: [
          { role: 'system', content: this.buildCopilotSystemPrompt() },
          ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
          { role: 'user', content: message },
        ],
        // biome-ignore lint/suspicious/noExplicitAny: OpenAI SDK tool type requires cast
        tools: tools as any,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 500,
        stream: true,
      },
      { maxChatCompletions: 5 },
    );
  }

  /** @deprecated Dùng chatCopilotWithTools khi COPILOT_USE_FUNCTION_CALLING=1 */
  async classifyTransaction(
    content: string,
    amount: number,
    direction: 'in' | 'out',
    fewShotExamples: FewShotExample[],
  ): Promise<ClassificationResult | null> {
    if (!this.client) {
      return null;
    }

    const examplesText =
      fewShotExamples.length > 0
        ? `\nVí dụ từ lịch sử định khoản của doanh nghiệp này:\n${fewShotExamples
            .map((e) => `- Nội dung: "${e.content}" → Nợ ${e.debitAccount} / Có ${e.creditAccount}`)
            .join('\n')}\n`
        : '';

    const systemPrompt = `Bạn là kế toán chuyên nghiệp Việt Nam, thành thạo chuẩn kế toán TT133 (Thông tư 133/2016/TT-BTC cho doanh nghiệp nhỏ và vừa).

Nhiệm vụ: Phân tích nội dung giao dịch ngân hàng và đề xuất định khoản kế toán theo TT133.

Các tài khoản TT133 thường dùng:
- 111: Tiền mặt | 112: Tiền gửi ngân hàng
- 131: Phải thu khách hàng | 331: Phải trả người bán
- 333: Thuế và các khoản phải nộp | 334: Phải trả người lao động
- 511: Doanh thu bán hàng | 515: Doanh thu tài chính
- 521: Giảm trừ doanh thu
- 621: Chi phí NVL trực tiếp | 622: Chi phí nhân công
- 627: Chi phí sản xuất chung | 635: Chi phí tài chính
- 641: Chi phí bán hàng | 642: Chi phí quản lý doanh nghiệp
- 156: Hàng hóa | 211: TSCĐ hữu hình

Quy tắc: Giao dịch tiền vào ngân hàng → Nợ 112. Giao dịch tiền ra → Có 112.
${examplesText}
Trả lời CHÍNH XÁC theo JSON, không giải thích thêm:
{"debitAccount":"xxx","creditAccount":"xxx","confidence":0-100,"reason":"lý do ngắn gọn tiếng Việt"}`;

    const userMessage = `Nội dung GD: "${content}"
Số tiền: ${Math.abs(amount).toLocaleString('vi-VN')}đ
Chiều: ${direction === 'in' ? 'Tiền VÀO tài khoản' : 'Tiền RA khỏi tài khoản'}

Định khoản:`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.chatModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const text = response.choices[0]?.message?.content;
      if (!text) return null;

      const parsed = JSON.parse(text) as {
        debitAccount: string;
        creditAccount: string;
        confidence: number;
        reason: string;
      };

      return {
        debitAccount: String(parsed.debitAccount),
        creditAccount: String(parsed.creditAccount),
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence))),
        reason: String(parsed.reason),
      };
    } catch (error) {
      this.logger.error(
        'OpenAI classification failed',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }
}
