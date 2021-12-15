import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { User } from 'src/database/user.entity';
import { AdminGuard } from 'src/guards/admin.guard';
import { AuthGuard } from 'src/guards/auth.guard';

@Controller('admin/users')
@UseGuards(AuthGuard, AdminGuard)
export class AdminUserController {

  @Get()
  public async getAll(@Query("from") skip?: number, @Query("size") take?: number, @Query("q") query?: string) {
    return await User.find({ take, skip, relations: ["roles", "createdProjects"], where: query ? { name: query } : { } });
  }

  @Delete(":id")
  public async deleteUser(@Param("id") id: number) {
    return (await User.findOne(id)).remove();
  }
}
