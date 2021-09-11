import { IsEmail, IsNotEmpty, MinLength, ValidateIf } from "class-validator";

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