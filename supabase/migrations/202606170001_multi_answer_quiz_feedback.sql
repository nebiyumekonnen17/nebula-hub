alter table public.aws_quiz_questions
add column if not exists correct_answer_indexes integer[];

update public.aws_quiz_questions
set correct_answer_indexes = array[correct_answer_index]
where correct_answer_indexes is null
  and correct_answer_index is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'aws_quiz_questions_correct_answer_indexes_valid'
      and conrelid = 'public.aws_quiz_questions'::regclass
  ) then
    alter table public.aws_quiz_questions
    add constraint aws_quiz_questions_correct_answer_indexes_valid
    check (
      correct_answer_indexes is null
      or (
        array_length(correct_answer_indexes, 1) between 1 and 6
        and correct_answer_indexes <@ array[0, 1, 2, 3, 4, 5]
      )
    );
  end if;
end $$;

create table if not exists public.quiz_answer_feedback (
  id uuid primary key default gen_random_uuid(),
  question_id bigint not null,
  selected_answer_indexes integer[],
  suggested_answer_indexes integer[],
  message text not null,
  reporter_name text,
  contact text,
  quiz_mode text,
  page_url text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint quiz_answer_feedback_message_length check (char_length(message) between 3 and 1200),
  constraint quiz_answer_feedback_reporter_name_length check (reporter_name is null or char_length(reporter_name) <= 120),
  constraint quiz_answer_feedback_contact_length check (contact is null or char_length(contact) <= 160),
  constraint quiz_answer_feedback_status_valid check (status in ('new', 'reviewed', 'resolved', 'rejected')),
  constraint quiz_answer_feedback_mode_valid check (quiz_mode is null or quiz_mode in ('exam', 'study'))
);

alter table public.quiz_answer_feedback
add column if not exists reporter_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quiz_answer_feedback_reporter_name_length'
      and conrelid = 'public.quiz_answer_feedback'::regclass
  ) then
    alter table public.quiz_answer_feedback
    add constraint quiz_answer_feedback_reporter_name_length
    check (reporter_name is null or char_length(reporter_name) <= 120);
  end if;
end $$;

alter table public.quiz_answer_feedback enable row level security;

drop policy if exists "Allow public quiz feedback inserts" on public.quiz_answer_feedback;

create policy "Allow public quiz feedback inserts"
on public.quiz_answer_feedback
for insert
to anon
with check (true);
