-- Loan disbursement module — schema as deployed.

CREATE TABLE borrower (
    id              bigserial PRIMARY KEY,
    national_id     varchar(30) NOT NULL UNIQUE,
    full_name       varchar(200) NOT NULL,
    kyc_status      varchar(20) NOT NULL DEFAULT 'PENDING',
    is_blacklisted  boolean NOT NULL DEFAULT false,
    branch_code     varchar(10) NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE loan (
    id                bigserial PRIMARY KEY,
    borrower_id       bigint NOT NULL REFERENCES borrower(id),
    borrower_account  varchar(20) NOT NULL,
    product_code      varchar(20) NOT NULL,
    principal         numeric(18,2) NOT NULL,
    tenor_months      integer NOT NULL,
    interest_rate     numeric(6,3) NOT NULL,
    status            varchar(20) NOT NULL DEFAULT 'DRAFT',
    approved_by       bigint,
    approved_at       timestamptz,
    disbursed_at      timestamptz,
    disbursed_amount  numeric(18,2),
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE disbursement_txn (
    id            bigserial PRIMARY KEY,
    loan_id       bigint NOT NULL REFERENCES loan(id),
    amount        numeric(18,2) NOT NULL,
    tranche_no    integer,
    ledger_ref    varchar(64),
    created_by    bigint NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE loan_schedule (
    id              bigserial PRIMARY KEY,
    loan_id         bigint NOT NULL REFERENCES loan(id),
    installment_no  integer NOT NULL,
    due_date        date NOT NULL,
    installment     numeric(18,2) NOT NULL,
    paid            boolean NOT NULL DEFAULT false,
    paid_at         timestamptz
);

CREATE TABLE repayment (
    id            bigserial PRIMARY KEY,
    loan_id       bigint NOT NULL REFERENCES loan(id),
    schedule_id   bigint REFERENCES loan_schedule(id),
    amount        numeric(18,2) NOT NULL,
    received_at   timestamptz NOT NULL DEFAULT now(),
    channel       varchar(20) NOT NULL
);

CREATE TABLE holiday_calendar (
    calendar_date  date PRIMARY KEY,
    description    varchar(100) NOT NULL,
    branch_code    varchar(10)
);

CREATE INDEX idx_loan_borrower ON loan(borrower_id);
CREATE INDEX idx_disb_loan ON disbursement_txn(loan_id);
CREATE INDEX idx_sched_loan_due ON loan_schedule(loan_id, due_date);
