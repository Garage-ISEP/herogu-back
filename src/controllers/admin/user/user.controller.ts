import { UserRepository } from './../../../database/user/user.repository';
import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { User } from 'src/database/user/user.entity';
import { AdminGuard } from 'src/guards/admin.guard';
import { AuthGuard } from 'src/guards/auth.guard';
import { InjectRepository } from '@nestjs/typeorm';

@Controller('admin/users')
@UseGuards(AuthGuard, AdminGuard)
export class AdminUserController {

  constructor(
        private readonly _userRepo: UserRepository
  ) { }

  @Get()
  public async getAll(@Query("from") skip?: number, @Query("size") take?: number, @Query("q") query?: string) {
    return await this._userRepo.getAll(take, skip, query);
  }

  @Delete(":id")
  public async deleteUser(@Param("id") id: string) {
    return await this._userRepo.removeOne(id);
  }
}
