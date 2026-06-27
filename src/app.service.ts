import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  healthCkeck() {
    return {
      success: true,
      message: 'Server for Job Portal is UP',
      timeStamp: new Date().toISOString(),
    };
  }
}
