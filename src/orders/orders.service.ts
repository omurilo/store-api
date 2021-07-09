import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, EntityNotFoundError, In, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { PaymentService } from './payment/payment.service';
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    private paymentService: PaymentService,
    private connection: Connection,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    const order = this.orderRepo.create(createOrderDto);

    const products = await this.productRepo.find({
      where: {
        id: In(order.items.map((item) => item.product_id)),
      },
    });

    order.items.forEach((item) => {
      const product = products.find((pItem) => pItem.id === item.product_id);

      item.price = product.price;
    });

    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let newOrder;

    try {
      newOrder = await queryRunner.manager.save(order);

      await this.paymentService.payment({
        creditCard: {
          name: order.credit_card.name,
          number: order.credit_card.number,
          expirationMonth: order.credit_card.expiration_month,
          expirationYear: order.credit_card.expiration_year,
          cvv: order.credit_card.cvv,
        },
        amount: order.total,
        store: process.env.STORE_NAME,
        description: `Produtos: ${products
          .map((product) => product.name)
          .join(', ')}`,
      });

      await queryRunner.manager.update(
        Order,
        { id: newOrder.id },
        { status: OrderStatus.Approved },
      );

      queryRunner.commitTransaction();

      return this.orderRepo.findOne(newOrder.id, { relations: ['items'] });
    } catch (error) {
      if (error.details !== 'transaction rejected by the bank') {
        queryRunner.rollbackTransaction();

        throw error;
      }

      await queryRunner.manager.update(
        Order,
        { id: newOrder.id },
        { status: OrderStatus.Rejected },
      );

      queryRunner.commitTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  findAll() {
    return this.orderRepo.find();
  }

  findOne(id: string) {
    return this.orderRepo.findOneOrFail(id, {
      relations: ['items', 'items.product'],
    });
  }

  update(id: string, updateOrderDto: UpdateOrderDto) {
    return this.orderRepo.update(id, updateOrderDto);
  }

  remove(id: string) {
    return this.orderRepo.delete(id);
  }
}
