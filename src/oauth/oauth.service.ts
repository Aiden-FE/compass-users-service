import { Injectable, Logger } from '@nestjs/common';
import { getEnvConfig, replaceVariablesInString } from '@app/common';
import { GoogleRecaptchaService } from '@app/google-recaptcha';
import { EmailService } from '@app/email';
import { random } from 'lodash';
import { RedisService } from '@app/redis';
import { CreateOauthDto } from './dto/create-oauth.dto';
import { UpdateOauthDto } from './dto/update-oauth.dto';
import { OAuthEmailCaptchaDto } from './oauth.dto';
import { EMAIL_CAPTCHA_TEMPLATE, REDIS_KEYS, SYSTEM_EMAIL_DISPLAY_ACCOUNT } from '../common';

@Injectable()
export class OauthService {
  constructor(
    private grService: GoogleRecaptchaService,
    private emailService: EmailService,
    private redisService: RedisService,
  ) {}

  async sendEmailCaptcha(params: OAuthEmailCaptchaDto) {
    const data = {
      type: 'email',
      account: params.email,
    };
    const hasLock = await this.redisService.get(REDIS_KEYS.CAPTCHA_LOCK, {
      params: data,
    });
    if (hasLock === 'true') {
      Logger.log(`邮箱${data.account}已发送过邮件,3分钟内不允许重复发送`);
      return false;
    }
    let valid: boolean;
    if (getEnvConfig('NODE_ENV') === 'development') {
      valid = true;
    } else {
      valid = await this.grService.verifyRecaptcha({
        score: 0.9, // 登录需要较高准确度,避免被恶意刷邮件
        response: params.recaptcha,
      });
    }
    if (!valid) {
      Logger.log(`Google recaptcha 验证失败: ${params.recaptcha}`);
      return false;
    }
    const code = random(100000, 999999);
    await this.emailService.sendEmail({
      from: SYSTEM_EMAIL_DISPLAY_ACCOUNT,
      to: params.email,
      subject: 'Compass 邮件验证',
      html: replaceVariablesInString(EMAIL_CAPTCHA_TEMPLATE, {
        context: 'Compass',
        code: code.toString(),
      }),
    });
    return Promise.all([
      // 将code存入redis缓存
      this.redisService.set(REDIS_KEYS.CAPTCHA, code, {
        params: data,
      }),
      // 锁定下一次发送的间隔
      this.redisService.set(REDIS_KEYS.CAPTCHA_LOCK, 'true', {
        params: data,
        expiresIn: 1000 * 60 * 3,
      }),
    ])
      .then(() => true)
      .catch((e) => {
        Logger.error(e);
        return false;
      });
  }

  create(createOauthDto: CreateOauthDto) {
    return 'This action adds a new oauth';
  }

  findAll() {
    return `This action returns all oauth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} oauth`;
  }

  update(id: number, updateOauthDto: UpdateOauthDto) {
    return `This action updates a #${id} oauth`;
  }

  remove(id: number) {
    return `This action removes a #${id} oauth`;
  }
}
