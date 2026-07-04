import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class BulkReclassifyDto {
  @ApiProperty({
    type: [String],
    description: 'Danh sách ID giao dịch (UUID) cần đẩy lại job AI',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Phải chọn ít nhất 1 giao dịch' })
  @ArrayMaxSize(50, { message: 'Tối đa 50 giao dịch mỗi lần' })
  @IsUUID('4', { each: true, message: 'ID giao dịch không hợp lệ' })
  ids!: string[];
}
