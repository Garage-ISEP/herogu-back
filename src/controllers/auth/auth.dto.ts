import { IsEmail, IsNotEmpty, MinLength, ValidateIf } from "class-validator";
import { User } from "src/database/user.entity";

export class LoginDto {

  @ValidateIf(stdId => /^\w{4}\d{5}$/.test(stdId))
  @IsNotEmpty()
  public studentId: string;

  @MinLength(8)
  @IsNotEmpty()
  @ValidateIf(password => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password))
  public password: string;
}

export class RegisterDto {

  @IsEmail()
  @IsNotEmpty()
  @ValidateIf(email => /^([a-z]+)(-[a-z]+)?(\.)([a-z]+)(-[a-z]+)?(@eleve\.isep\.fr)$/.test(email))
  public email: string;

  @MinLength(8)
  @IsNotEmpty()
  @ValidateIf(password => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password))
  public password: string;

  @ValidateIf(stdId => /^\w{4}\d{5}$/.test(stdId))
  @IsNotEmpty()
  public studentId: string;

  public toString(): string {
    return `User : [email = ${this.email}, studentId = ${this.studentId}]`;
  }
}

export class UpdatePasswordDto {

  @MinLength(8)
  @IsNotEmpty()
  @ValidateIf(password => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password))
  public password: string;

  @MinLength(8)
  @IsNotEmpty()
  @ValidateIf(newPassword => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(newPassword))
  public newPassword: string;
}

export class LoginResponse {
  constructor(
    public token: string,
    public user: User,
  ) { }
}