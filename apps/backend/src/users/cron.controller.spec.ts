import { UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { UsersService } from './users.service';
import { CronController } from './cron.controller';

describe('CronController (guard CRON_SECRET)', () => {
  const processPendingDeletions = jest.fn();
  const configRequire = jest.fn();

  const users = { processPendingDeletions } as unknown as UsersService;
  const config = { require: configRequire } as unknown as AppConfigService;

  let controller: CronController;

  beforeEach(() => {
    jest.clearAllMocks();
    configRequire.mockReturnValue('s3cr3t');
    controller = new CronController(users, config);
  });

  it('đúng Bearer secret → chạy processPendingDeletions', async () => {
    processPendingDeletions.mockResolvedValue({ processed: 0, results: [] });
    const res = await controller.process('Bearer s3cr3t');
    expect(res).toEqual({ processed: 0, results: [] });
    expect(processPendingDeletions).toHaveBeenCalledTimes(1);
  });

  it('sai secret → Unauthorized', () => {
    expect(() => controller.process('Bearer wrong')).toThrow(
      UnauthorizedException,
    );
    expect(processPendingDeletions).not.toHaveBeenCalled();
  });

  it('thiếu header → Unauthorized', () => {
    expect(() => controller.process(undefined)).toThrow(UnauthorizedException);
  });
});
