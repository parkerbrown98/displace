import { Injectable } from '@nestjs/common';
import { Clock } from './clock.js';

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
