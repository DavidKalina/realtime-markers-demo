import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm";
import { User } from "./User";
import { Event } from "./Event";

@Entity("organizations")
export class Organization {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar" })
    name!: string;

    @Column({ type: "text", nullable: true })
    description?: string;

    @Column({ type: "varchar", nullable: true })
    logoUrl?: string;

    @Column({ type: "varchar", nullable: true })
    website?: string;

    @Column({ type: "varchar", nullable: true })
    contactEmail?: string;

    @Column({ type: "varchar", nullable: true })
    contactPhone?: string;

    @Column({ type: "boolean", default: false })
    isActive!: boolean;

    @Column({ type: "varchar", nullable: true })
    stripeCustomerId?: string;

    @Column({ type: "varchar", nullable: true })
    stripeSubscriptionId?: string;

    @Column({ type: "timestamptz", nullable: true })
    subscriptionEndDate?: Date;

    @Index()
    @Column({ name: "owner_id", type: "uuid" })
    ownerId!: string;

    @ManyToOne(() => User, (user) => user.ownedOrganizations, { onDelete: "CASCADE" })
    @JoinColumn({ name: "owner_id" })
    owner!: User;

    @OneToMany(() => User, (user) => user.organization)
    members!: User[];

    @OneToMany(() => Event, (event) => event.organization)
    events!: Event[];

    @CreateDateColumn({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;
} 