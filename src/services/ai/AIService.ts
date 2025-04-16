import { getOpenAI } from '../../utilities/openai';
import prompt from '../../utilities/tickets/prompt.txt';

export async function getCategoryAndSeverity(text: string): Promise<{
  category:
    | 'general_support'
    | 'game_issues'
    | 'user_reports'
    | 'staff_reports_management';
  severity: number;
} | null> {
  const openai = await getOpenAI();

  const chatCompletion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'category_response',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: "The category of the user's text.",
              enum: [
                'general_support',
                'game_issues',
                'user_reports',
                'staff_reports_management',
              ],
            },
            severity: {
              type: 'number',
              description:
                'Severity or urgency rating on a scale from 1 to 10.',
            },
          },
          required: ['category', 'severity'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = chatCompletion.choices[0].message.content;
  if (!content) return null;
  const json = JSON.parse(content);
  if (json.category && json.severity) {
    return {
      category: json.category,
      severity: json.severity,
    };
  }

  return null;
}
