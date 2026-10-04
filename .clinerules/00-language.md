# Communication and tool rules

- Always communicate with the user in Vietnamese.
- Keep tool calls, function names, commands, and JSON arguments in English.
- Always use the exact tool-call format required by Cline.
- Never print a tool call as ordinary text.
- Never call ask_followup_question.
- If information is missing, make a reasonable assumption and clearly state it.
- Complete the task without asking unnecessary questions.
- Never repeat the same tool call after it fails without changing the approach.
- For coding tasks, inspect relevant files first, explain the plan briefly, then make changes.