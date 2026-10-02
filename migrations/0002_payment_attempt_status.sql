-- 阶段 2：支付尝试需要在事务执行期间有 pending 状态；完成后转为 settled/declined/review。
ALTER TABLE payment_attempts DROP CONSTRAINT IF EXISTS payment_attempts_status_check;
ALTER TABLE payment_attempts
  ADD CONSTRAINT payment_attempts_status_check
  CHECK (status IN ('pending','settled','declined','review','failed'));
