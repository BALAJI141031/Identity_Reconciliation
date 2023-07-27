import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Contact, Prisma } from '@prisma/client';

@Injectable()
export class ContactDao {
  @Inject(PrismaService)
  private prisma: PrismaService;

  async createContact(data: Prisma.ContactCreateInput) {
    return await this.prisma.contact.create({ data });
  }

  async getContactByEmailOrPhone(
    identifier: string,
  ): Promise<Contact[] | null> {
    return await this.prisma.contact.findMany({
      where: {
        OR: [{ email: identifier }, { phoneNumber: identifier }],
      },
    });
  }

  async getContactByEmailAndPhone(
    where: Prisma.ContactWhereInput,
  ): Promise<Contact | null> {
    return await this.prisma.contact.findFirst({
      where,
    });
  }

  async getPrimaryContact(
    where: Prisma.ContactWhereInput,
  ): Promise<Contact | null> {
    return await this.prisma.contact.findFirst({
      where,
    });
  }
  async getContacts(where: Prisma.ContactWhereInput) {
    return await this.prisma.contact.findMany({
      where,
    });
  }
}
