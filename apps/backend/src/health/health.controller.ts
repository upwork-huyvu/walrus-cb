import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'cool-bath-backend',
      time: new Date().toISOString(),
    };
  }
}
