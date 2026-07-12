import type { Role } from '@xcash/shared-types';
import type { CopilotToolEntry } from '../copilot-tool.types';

export const actionTools: CopilotToolEntry[] = [
  {
    name: 'propose_confirm_transaction_classification',
    description:
      'Chỉ dùng khi user yêu cầu rõ ràng xác nhận/duyệt một giao dịch cụ thể. transactionId = field id (UUID nội bộ) từ list_review_queue hoặc search_transactions — KHÔNG dùng bankTransactionId. KHÔNG tự ý gợi ý xác nhận khi user chỉ hỏi thông tin chung. Tool này CHỈ đọc dữ liệu và đề xuất — không tự ghi xác nhận, người dùng phải bấm nút xác nhận trên giao diện.',
    parameters: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          description:
            'Mã GD nội bộ (UUID) — field id từ list_review_queue hoặc search_transactions',
        },
      },
      required: ['transactionId'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'action_card', label: 'Đề xuất xác nhận giao dịch', source: 'X-Cash AI' },
      streaming: {
        kind: 'action_card',
        label: 'Đang chuẩn bị đề xuất xác nhận…',
        source: 'X-Cash AI',
      },
    },
    enabledBy: 'COPILOT_ACTION_TOOLS_ENABLED',
    execute: (deps, tenantId, args, role) =>
      deps.classificationService.proposeConfirmClassification(
        tenantId,
        String(args.transactionId),
        role ?? ('viewer' as Role),
      ),
  },
  {
    name: 'propose_correct_transaction_classification',
    description:
      'Chỉ dùng khi user tự nêu rõ muốn sửa một giao dịch cụ thể thành cặp tài khoản Nợ/Có mới. transactionId = field id (UUID nội bộ) từ list_review_queue hoặc search_transactions. KHÔNG tự đề xuất định khoản mới thay user. Tool này CHỈ đọc dữ liệu, validate mã tài khoản và đề xuất — không tự ghi sửa, người dùng phải bấm nút trên giao diện.',
    parameters: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          description:
            'Mã GD nội bộ (UUID) — field id từ list_review_queue hoặc search_transactions',
        },
        debitAccount: {
          type: 'string',
          description: 'Mã tài khoản Nợ mới do user chỉ định, vd "641"',
        },
        creditAccount: {
          type: 'string',
          description: 'Mã tài khoản Có mới do user chỉ định, vd "111"',
        },
      },
      required: ['transactionId', 'debitAccount', 'creditAccount'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'action_card', label: 'Đề xuất sửa định khoản', source: 'X-Cash AI' },
      streaming: {
        kind: 'action_card',
        label: 'Đang chuẩn bị đề xuất sửa định khoản…',
        source: 'X-Cash AI',
      },
    },
    enabledBy: 'COPILOT_ACTION_TOOLS_ENABLED',
    execute: (deps, tenantId, args, role) =>
      deps.classificationService.proposeCorrectClassification(
        tenantId,
        String(args.transactionId),
        String(args.debitAccount),
        String(args.creditAccount),
        role ?? ('viewer' as Role),
      ),
  },
];
