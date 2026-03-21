import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Send weekly puzzle email to a user
 */
export async function sendWeeklyPuzzleEmail(userEmail, puzzle) {
  if (!resend) {
    console.warn('Resend API key not configured - skipping email to', userEmail);
    return { success: false, error: 'Email service not configured' };
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .puzzle-title {
          color: #667eea;
          font-size: 24px;
          margin-bottom: 10px;
        }
        .difficulty {
          font-size: 18px;
          margin: 10px 0;
        }
        .cta-button {
          display: inline-block;
          background: #667eea;
          color: white;
          text-decoration: none;
          padding: 15px 30px;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          font-size: 12px;
          color: #888;
        }
        .unsubscribe {
          color: #888;
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>♟️ Your Weekly 3D Chess Puzzle</h1>
      </div>
      <div class="content">
        <h2 class="puzzle-title">${puzzle.title}</h2>
        <p>${puzzle.description}</p>
        <p class="difficulty">
          <strong>Difficulty:</strong> ${'⭐'.repeat(puzzle.difficulty)}
        </p>
        ${puzzle.hint ? `<p><em>Hint: ${puzzle.hint}</em></p>` : ''}
        <a href="${clientUrl}/?puzzle=${puzzle.id}" class="cta-button">
          Solve This Week's Puzzle
        </a>
        <p style="margin-top: 30px; color: #666;">
          Challenge yourself with this week's 3D chess puzzle. Can you find the mate in 1?
        </p>
      </div>
      <div class="footer">
        <p>You're receiving this because you subscribed to weekly puzzles.</p>
        <a href="${clientUrl}/unsubscribe" class="unsubscribe">Unsubscribe</a>
      </div>
    </body>
    </html>
  `;

  const text = `
Your Weekly 3D Chess Puzzle: ${puzzle.title}

${puzzle.description}

Difficulty: ${'⭐'.repeat(puzzle.difficulty)}

${puzzle.hint ? `Hint: ${puzzle.hint}` : ''}

Solve this week's puzzle: ${clientUrl}/?puzzle=${puzzle.id}

Unsubscribe: ${clientUrl}/unsubscribe
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Raumschach Puzzles <puzzles@yourdomain.com>',
      to: userEmail,
      subject: `Weekly Puzzle: ${puzzle.title}`,
      html,
      text
    });

    if (error) {
      console.error('Email send error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email service error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(userEmail) {
  if (!resend) {
    console.warn('Resend API key not configured - skipping welcome email');
    return { success: false, error: 'Email service not configured' };
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .cta-button {
          display: inline-block;
          background: #667eea;
          color: white;
          text-decoration: none;
          padding: 15px 30px;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>♟️ Welcome to Raumschach!</h1>
      </div>
      <div class="content">
        <h2>Welcome to 3D Chess</h2>
        <p>Thanks for joining Raumschach! You're now part of a community of 3D chess enthusiasts.</p>
        <p>Raumschach is a chess variant played on a 5×5×5 board, offering a unique three-dimensional challenge.</p>
        <h3>Get Started:</h3>
        <ul>
          <li>Try our collection of mate-in-1 puzzles</li>
          <li>Subscribe to weekly puzzle challenges</li>
          <li>Play against our AI opponent</li>
          <li>Master the art of 3D chess</li>
        </ul>
        <a href="${clientUrl}" class="cta-button">Start Playing Now</a>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Raumschach <welcome@yourdomain.com>',
      to: userEmail,
      subject: 'Welcome to Raumschach - 3D Chess',
      html
    });

    if (error) {
      console.error('Welcome email error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email service error:', error);
    return { success: false, error: error.message };
  }
}
