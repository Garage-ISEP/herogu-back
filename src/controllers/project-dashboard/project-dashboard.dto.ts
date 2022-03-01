import { PhpLogLevel } from '../../database/project/php-info.entity';
import { IsBoolean, IsEnum } from 'class-validator';

export class PhpLogLevelDto {

  @IsEnum(PhpLogLevel)
  public logLevel: PhpLogLevel;

  @IsBoolean()
  public logEnabled: boolean;
}