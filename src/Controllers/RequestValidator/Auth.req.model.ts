import { IsNotEmpty, MinLength, ValidateIf } from 'class-validator';

export class LoginRequest {

  @MinLength(8)
  @IsNotEmpty()
  @ValidateIf(password => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password))
  password: string;

  @ValidateIf(stdId => /^\w{4}\d{5}$/.test(stdId))
  @IsNotEmpty()
  student_id: string;

}