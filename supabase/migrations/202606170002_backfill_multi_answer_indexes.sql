with answer_labels as (
  select
    id,
    (
      regexp_match(
        explanation,
        '(?:multiple\s+correct\s+answers?|correct\s+answers?)\s*:\s*([A-F](?:\s*(?:,|and|&)\s*[A-F])*)',
        'i'
      )
    )[1] as answer_label
  from public.aws_quiz_questions
  where explanation ~* '(multiple\s+correct\s+answers?|correct\s+answers?)\s*:'
),
parsed_answers as (
  select
    id,
    array(
      select distinct ascii(upper(letter[1])) - ascii('A')
      from regexp_matches(answer_label, '[A-F]', 'gi') as letter
      order by ascii(upper(letter[1])) - ascii('A')
    ) as parsed_indexes
  from answer_labels
  where answer_label is not null
)
update public.aws_quiz_questions question
set correct_answer_indexes = parsed.parsed_indexes
from parsed_answers parsed
where question.id = parsed.id
  and array_length(parsed.parsed_indexes, 1) > 1
  and (
    question.correct_answer_indexes is null
    or question.correct_answer_indexes is distinct from parsed.parsed_indexes
  );
