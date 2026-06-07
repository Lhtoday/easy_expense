import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUserGuard, RequestWithUser } from '../identity/current-user.guard';
import {
  CreateExpensePolicyDto,
  CreateExpensePolicyRuleDto,
  CreateExpenseTypeDto,
  ExpensePolicyListQueryDto,
  UpdateExpensePolicyDto,
  UpdateExpensePolicyRuleDto,
  UpdateExpenseTypeDto,
} from './expense-policy.dto';
import { ExpensePoliciesService } from './expense-policies.service';

@Controller()
@UseGuards(CurrentUserGuard)
export class ExpensePoliciesController {
  constructor(private readonly service: ExpensePoliciesService) {}

  @Get('expense-types')
  listExpenseTypes(@Req() request: RequestWithUser, @Query() query: ExpensePolicyListQueryDto) {
    return this.service.listExpenseTypes(request.user, query);
  }

  @Post('expense-types')
  createExpenseType(@Req() request: RequestWithUser, @Body() dto: CreateExpenseTypeDto) {
    return this.service.createExpenseType(request.user, dto);
  }

  @Patch('expense-types/:id')
  updateExpenseType(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateExpenseTypeDto) {
    return this.service.updateExpenseType(request.user, id, dto);
  }

  @Delete('expense-types/:id')
  disableExpenseType(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.disableExpenseType(request.user, id);
  }

  @Get('expense-policies')
  listPolicies(@Req() request: RequestWithUser, @Query() query: ExpensePolicyListQueryDto) {
    return this.service.listPolicies(request.user, query);
  }

  @Post('expense-policies')
  createPolicy(@Req() request: RequestWithUser, @Body() dto: CreateExpensePolicyDto) {
    return this.service.createPolicy(request.user, dto);
  }

  @Patch('expense-policies/:id')
  updatePolicy(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateExpensePolicyDto) {
    return this.service.updatePolicy(request.user, id, dto);
  }

  @Delete('expense-policies/:id')
  disablePolicy(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.disablePolicy(request.user, id);
  }

  @Post('expense-policies/:policyId/rules')
  createRule(@Req() request: RequestWithUser, @Param('policyId') policyId: string, @Body() dto: CreateExpensePolicyRuleDto) {
    return this.service.createRule(request.user, policyId, dto);
  }

  @Patch('expense-policies/:policyId/rules/:ruleId')
  updateRule(
    @Req() request: RequestWithUser,
    @Param('policyId') policyId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateExpensePolicyRuleDto,
  ) {
    return this.service.updateRule(request.user, policyId, ruleId, dto);
  }

  @Delete('expense-policies/:policyId/rules/:ruleId')
  disableRule(@Req() request: RequestWithUser, @Param('policyId') policyId: string, @Param('ruleId') ruleId: string) {
    return this.service.disableRule(request.user, policyId, ruleId);
  }
}
