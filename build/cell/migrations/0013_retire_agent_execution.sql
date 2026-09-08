-- Retire the hosted-execution queue of the platform-era hermes-worker. The
-- worker, its dispatch route, and the lease/heartbeat surface are removed
-- with BO_0104; these tables held only ephemeral queue records of that
-- retired path, so they retire with their code rather than living on as
-- dead schema. Drop order follows the foreign keys in 0007. BO_0104
drop table if exists agent_execution_result;
drop table if exists agent_execution_event;
drop table if exists agent_execution_lease;
drop table if exists agent_execution;
