import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;

    return Response.json({ content });
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    return Response.json(
      { error: error.message || 'Failed to get response from OpenAI' },
      { status: 500 }
    );
  }
}
