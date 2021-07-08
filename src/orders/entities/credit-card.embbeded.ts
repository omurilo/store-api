import { Exclude, Transform } from 'class-transformer';
import { Column } from 'typeorm';

export class CreditCard {
  @Transform((params) => params.value.substr(-4).padStart(16, '*'))
  @Column({ name: 'credit_card_number' })
  number: string;

  @Exclude()
  @Column({ name: 'credit_card_name' })
  name: string;

  @Exclude()
  @Column({ name: 'credit_card_cvv' })
  cvv: string;

  @Column({ name: 'credit_card_expiration_month' })
  expiration_month: number;

  @Column({ name: 'credit_card_expiration_year' })
  expiration_year: number;
}
