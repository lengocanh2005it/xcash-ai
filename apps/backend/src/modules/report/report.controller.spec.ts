import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { SubscriptionQueryAdapter } from '../../common/services/subscription-query.adapter';
import { ReportController } from './report.controller';
import { ReportDataService } from './report-data.service';
import { ReportExportService } from './report-export.service';

describe('ReportController — copilot export', () => {
  let controller: ReportController;
  const getExportFile = jest.fn();

  beforeEach(async () => {
    getExportFile.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        { provide: ReportDataService, useValue: {} },
        { provide: ReportExportService, useValue: { getExportFile } },
        Reflector,
        { provide: SubscriptionQueryAdapter, useValue: {} },
      ],
    }).compile();

    controller = moduleRef.get(ReportController);
  });

  it('returns the file from ReportExportService.getExportFile', async () => {
    getExportFile.mockResolvedValue({
      buffer: Buffer.from('pdf-bytes'),
      contentType: 'application/pdf',
      fileName: 'bao-cao.pdf',
    });
    const res = { set: jest.fn() } as unknown as Response;

    const file = await controller.getCopilotExport(
      { tenantId: 'tenant-1' } as never,
      'export-1',
      { format: 'pdf', fromDate: '2026-06-01', toDate: '2026-06-30' },
      res,
    );

    expect(getExportFile).toHaveBeenCalledWith('export-1', 'tenant-1', {
      format: 'pdf',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    });
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="bao-cao.pdf"',
    });
    expect(file).toBeDefined();
  });
});
