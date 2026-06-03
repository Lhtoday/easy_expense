-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "MasterDataStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "DataScopeType" AS ENUM ('ALL', 'OWN_DEPARTMENT', 'OWN', 'CUSTOM');

-- CreateTable
CREATE TABLE "iam_users" (
    "id" TEXT NOT NULL,
    "employee_no" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "department_id" TEXT,
    "cost_center_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "iam_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "iam_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iam_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iam_user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "iam_role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iam_role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "iam_data_scopes" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scope_type" "DataScopeType" NOT NULL,
    "department_id" TEXT,
    "cost_center_id" TEXT,
    "project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iam_data_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "md_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_cost_centers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "md_cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "md_projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "department_id" TEXT,
    "cost_center_id" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "md_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "iam_users_employee_no_key" ON "iam_users"("employee_no");

-- CreateIndex
CREATE UNIQUE INDEX "iam_users_email_key" ON "iam_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "iam_roles_code_key" ON "iam_roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "iam_permissions_code_key" ON "iam_permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "iam_data_scopes_role_id_resource_key" ON "iam_data_scopes"("role_id", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "md_departments_code_key" ON "md_departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "md_cost_centers_code_key" ON "md_cost_centers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "md_projects_code_key" ON "md_projects"("code");

-- AddForeignKey
ALTER TABLE "iam_users" ADD CONSTRAINT "iam_users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_users" ADD CONSTRAINT "iam_users_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "md_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_user_roles" ADD CONSTRAINT "iam_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_user_roles" ADD CONSTRAINT "iam_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "iam_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_role_permissions" ADD CONSTRAINT "iam_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "iam_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_role_permissions" ADD CONSTRAINT "iam_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "iam_permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_data_scopes" ADD CONSTRAINT "iam_data_scopes_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "iam_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_data_scopes" ADD CONSTRAINT "iam_data_scopes_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_data_scopes" ADD CONSTRAINT "iam_data_scopes_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "md_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_data_scopes" ADD CONSTRAINT "iam_data_scopes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "md_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "md_departments" ADD CONSTRAINT "md_departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "md_cost_centers" ADD CONSTRAINT "md_cost_centers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "md_projects" ADD CONSTRAINT "md_projects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "md_projects" ADD CONSTRAINT "md_projects_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "md_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
