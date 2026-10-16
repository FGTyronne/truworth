# TruWorth Newsletter Operations

## Audience

Resend segment: **TruWorth Newsletter**

Purpose: opt-in emails about TruWorth news, the future domain change, new Member Benefits, specials and useful product/service updates.

Do not add account holders automatically. A person joins only after an explicit newsletter subscription action.

## Sender

Use the existing verified TruWorth sender:

`TruWorth <notifications@truworth.ramellacorporateconsulting.com>`

## Broadcast base

Resend draft name: **TruWorth Newsletter Base — duplicate before sending**

Every new newsletter should start from a duplicate of this base so the required footer remains consistent.

The footer must always contain:

- why the recipient is receiving the email;
- **Manage preferences or unsubscribe** linking to `https://truworth-web.onrender.com/unsubscribe.html?t={{{unsubscribe_token}}}`;
- Privacy link;
- operator name: Ramella Corporate Consulting Ltd.

Keep the footer short. Do not add repetitive scoring, AI, affiliate or recommendation disclaimers to ordinary newsletters.

## Unsubscribe

The branded unsubscribe page asks for a reason and confirmation.

On confirmation the backend:

1. marks the TruWorth newsletter subscription as unsubscribed;
2. records the selected reason and optional comment;
3. opts the contact out of the TruWorth updates topic;
4. removes the contact from the TruWorth Newsletter segment;
5. suppresses future newsletter broadcasts.

Newsletter unsubscribe does **not** cancel necessary account, authentication, payment, receipt or security emails.

## ChatGPT workflow

Typical flow:

1. User: `Draft a TruWorth newsletter about the new benefits.`
2. Create or duplicate a **draft** broadcast only. Do not send it yet.
3. Show the user the subject and final copy for approval.
4. User explicitly says `Send it` or gives a schedule.
5. Send/schedule the approved broadcast to the TruWorth Newsletter segment.
6. After sending, delivery/open/click/unsubscribe metrics can be retrieved through Resend.

Never send a newsletter merely because it was drafted or edited. Sending requires an explicit user instruction.
