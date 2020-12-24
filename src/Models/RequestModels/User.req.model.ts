import { IsEmail, IsUrl, MinLength, ValidateIf } from 'class-validator';

export default class UserReq {

  @IsEmail()
  @ValidateIf(email => /^([a-z]+)(-[a-z]+)?(\.)([a-z]+)(-[a-z]+)?(@eleve\.isep\.fr)$/.test(email))
  email: string;

  @MinLength(8)
  @ValidateIf(password => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password))
  password: string;

  @ValidateIf(stdId => /^\w{4}\d{5}$/.test(stdId))
  student_id: string;

}