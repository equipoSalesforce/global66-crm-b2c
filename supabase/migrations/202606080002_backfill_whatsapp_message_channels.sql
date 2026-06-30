update public.messages as message
set
  channel = 'WHATSAPP',
  message_type = coalesce(nullif(message.message_type, ''), 'TEXT')
from public.cases as case_record
where message.case_id = case_record.id
  and (
    case_record.channel = 'WHATSAPP'
    or case_record.contact_type = 'WHATSAPP'
  )
  and upper(coalesce(message.direction, '')) in ('INBOUND', 'OUTBOUND')
  and upper(coalesce(message.sender_type, '')) in ('CUSTOMER', 'AGENT')
  and (
    message.channel is null
    or message.channel = ''
  );
