import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateContactDto } from './dto';
import { ContactDao } from './app.repository';
import { PrismaClient, Contact, LinkPrecedence } from '@prisma/client';
@Injectable()
export class AppService {
  @Inject(ContactDao)
  private contactRepository: ContactDao;
  async createContact(createContactDto: CreateContactDto): Promise<any> {
    try {
      const { email, phoneNumber } = createContactDto;
      if (!email && !phoneNumber) {
        throw new BadRequestException(
          'Email Or PhoneNUmber is Require To Create Contact',
        );
      }

      if (email && !phoneNumber) {
        const exisitingContactWithEmail =
          await this.contactRepository.getContactByEmailOrPhone(email);
        if (exisitingContactWithEmail.length == 0) {
          const contact = await this.contactRepository.createContact({
            email,
            linkPrecedence: LinkPrecedence.primary,
          });
          return {
            contact: {
              primaryContatctId: contact.id,
              emails: [contact.email],
              phoneNumbers: [contact.phoneNumber],
              secondaryContactIds: [],
            },
          };
        }
        const primaryContact = exisitingContactWithEmail.filter(
          (contact) => contact.linkPrecedence == LinkPrecedence.primary,
        );
        if (primaryContact.length) {
          const secondaryContacts = await this.contactRepository.getContacts({
            linkedId: primaryContact[0].id,
          });
          const emails = secondaryContacts?.map((contact) => contact.email);
          const phoneNumbers = secondaryContacts?.map(
            (contact) => contact.phoneNumber,
          );
          const ids = secondaryContacts?.map((contact) => contact.id);
          //Todo fetch linked id's as well
          return {
            contact: {
              primaryContatctId: primaryContact[0].id,
              emails: [primaryContact[0].email, ...emails],
              phoneNumbers: [primaryContact[0].phoneNumber, ...phoneNumbers],
              secondaryContactIds: [...ids],
            },
          };
        } else {
          const linkId = exisitingContactWithEmail[0].linkedId;
          const emails = exisitingContactWithEmail?.map(
            (contact) => contact.email,
          );
          const phoneNumbers = exisitingContactWithEmail?.map(
            (contact) => contact.phoneNumber,
          );
          const ids = exisitingContactWithEmail?.map((contact) => contact.id);
          const primaryContact = await this.contactRepository.getPrimaryContact(
            {
              id: linkId,
            },
          );
          return {
            contact: {
              primaryContatctId: primaryContact.id,
              emails: [primaryContact.email, ...emails],
              phoneNumbers: [primaryContact.phoneNumber, ...phoneNumbers],
              secondaryContactIds: [...ids],
            },
          };
        }
      }

      if (!email && phoneNumber) {
        const exisitingContactWithPhone =
          await this.contactRepository.getContactByEmailOrPhone(phoneNumber);
        if (exisitingContactWithPhone.length == 0) {
          const contact = await this.contactRepository.createContact({
            phoneNumber,
            linkPrecedence: LinkPrecedence.primary,
          });
          return {
            contact: {
              primaryContatctId: contact.id,
              emails: [contact.email],
              phoneNumbers: [contact.phoneNumber],
              secondaryContactIds: [],
            },
          };
        }
        const primaryContact = exisitingContactWithPhone.filter(
          (contact) => contact.linkPrecedence == LinkPrecedence.primary,
        );
        const secondaryContacts = await this.contactRepository.getContacts({
          linkedId: primaryContact[0].id,
        });

        const emails = secondaryContacts?.map((contact) => contact.email);
        const phoneNumbers = secondaryContacts?.map(
          (contact) => contact.phoneNumber,
        );
        const ids = secondaryContacts?.map((contact) => contact.id);
        //Todo fetch linked id's as well
        return {
          contact: {
            primaryContatctId: primaryContact[0].id,
            emails: [primaryContact[0].email, ...emails],
            phoneNumbers: [primaryContact[0].phoneNumber, ...phoneNumbers],
            secondaryContactIds: [...ids],
          },
        };
      }

      const existingContactWithSameDetails =
        await this.contactRepository.getContactByEmailAndPhone({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.primary,
        });
      if (existingContactWithSameDetails) {
        // fetch links
        const secondaryContacts = await this.contactRepository.getContacts({
          linkedId: existingContactWithSameDetails.id,
        });
        const emails = secondaryContacts?.map((contact) => contact.email);
        const phoneNumbers = secondaryContacts?.map(
          (contact) => contact.phoneNumber,
        );
        const ids = secondaryContacts?.map((contact) => contact.id);
        return {
          contact: {
            primaryContatctId: existingContactWithSameDetails.id,
            emails: [existingContactWithSameDetails.email, ...emails],
            phoneNumbers: [
              existingContactWithSameDetails.phoneNumber,
              ...phoneNumbers,
            ],
            secondaryContactIds: [...ids],
          },
        };
      } else {
        const existingSecondaryContactWithSameDetails =
          await this.contactRepository.getContactByEmailAndPhone({
            email,
            phoneNumber,
            linkPrecedence: LinkPrecedence.secondary,
          });

        if (existingSecondaryContactWithSameDetails) {
          // fetch links
          const primaryContact = await this.contactRepository.getPrimaryContact(
            {
              id: existingSecondaryContactWithSameDetails.linkedId,
            },
          );
          const secondaryContacts = await this.contactRepository.getContacts({
            linkedId: primaryContact.id,
          });
          const emails = secondaryContacts?.map((contact) => contact.email);
          const phoneNumbers = secondaryContacts?.map(
            (contact) => contact.phoneNumber,
          );
          const ids = secondaryContacts?.map((contact) => contact.id);
          return {
            contact: {
              primaryContatctId: primaryContact.id,
              emails: [primaryContact.email, ...emails],
              phoneNumbers: [primaryContact.phoneNumber, ...phoneNumbers],
              secondaryContactIds: [...ids],
            },
          };
        }
      }
      // so email & phone combination is not there

      // checking for email Combination
      const exisitingContactWithEmail =
        await this.contactRepository.getContactByEmailOrPhone(email);
      const exisitingContactWithPhone =
        await this.contactRepository.getContactByEmailOrPhone(phoneNumber);
      if (
        !exisitingContactWithEmail.length &&
        !exisitingContactWithPhone.length
      ) {
        const contact = await this.contactRepository.createContact({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.primary,
        });
        return {
          contact: {
            primaryContatctId: contact.id,
            emails: [contact.email],
            phoneNumbers: [contact.phoneNumber],
            secondaryContactIds: [],
          },
        };
      }

      // create secondary contact with new mobile
      if (
        exisitingContactWithEmail.length &&
        !exisitingContactWithPhone.length
      ) {
        // get primary contact for linking purpose
        const primaryAccount = await this.contactRepository.getPrimaryContact({
          linkPrecedence: LinkPrecedence.primary,
          email,
        });
        await this.contactRepository.createContact({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: primaryAccount.id,
        });
        const secondaryContacts = await this.contactRepository.getContacts({
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: primaryAccount.id,
        });
        const emails = secondaryContacts?.map((contact) => contact.email);
        const phoneNumbers = secondaryContacts?.map(
          (contact) => contact.phoneNumber,
        );
        const ids = secondaryContacts?.map((contact) => contact.id);
        return {
          contact: {
            primaryContatctId: primaryAccount.id,
            emails: [primaryAccount.email, ...emails],
            phoneNumbers: [primaryAccount.phoneNumber, ...phoneNumbers],
            secondaryContactIds: [...ids],
          },
        };
      }
      // create secondary contact with new email
      if (
        !exisitingContactWithEmail.length &&
        exisitingContactWithPhone.length
      ) {
        const primaryAccount = await this.contactRepository.getPrimaryContact({
          linkPrecedence: LinkPrecedence.primary,
          phoneNumber,
        });
        await this.contactRepository.createContact({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: primaryAccount.id,
        });
        const secondaryContacts = await this.contactRepository.getContacts({
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: primaryAccount.id,
        });
        const emails = secondaryContacts?.map((contact) => contact.email);
        const phoneNumbers = secondaryContacts?.map(
          (contact) => contact.phoneNumber,
        );
        const ids = secondaryContacts?.map((contact) => contact.id);
        return {
          contact: {
            primaryContatctId: primaryAccount.id,
            emails: [primaryAccount.email, ...emails],
            phoneNumbers: [primaryAccount.phoneNumber, ...phoneNumbers],
            secondaryContactIds: [...ids],
          },
        };
      }

      const combinationContacts = [
        ...exisitingContactWithEmail,
        ...exisitingContactWithPhone,
      ].sort((a, b) => a.id - b.id);

      const updatedCombinationContacts = combinationContacts.map(
        (contact, i) => {
          if (i !== 0) {
            contact.linkPrecedence = LinkPrecedence.secondary;
            contact.linkedId = combinationContacts[0].id;
          }
          return contact;
        },
      );
      // updated db to mark secondary to primary
    } catch (error) {
      throw new InternalServerErrorException(
        `Server Error, error is ${error?.message}`,
      );
    }
  }
}
