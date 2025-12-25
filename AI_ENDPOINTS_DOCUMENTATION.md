# AI Endpoints Documentation

This API server acts as a proxy/gateway to the external AI server at `https://endi-ai.onrender.com/`.

## Base URL

All AI endpoints are prefixed with `/api/ai/`

## Authentication

All endpoints require authentication via Bearer token or HTTP-only cookie.

## Endpoints

### 1. POST `/api/ai/explain`

Explain code or answer questions about code.

**Request Body:**
```json
{
  "file_system": { ... },  // Optional: Dict representing file structure
  "question": "What does this code do?",
  "code_snippet": "print('Hello')"  // Optional: If not providing file_system
}
```

**Response:**
```json
{
  "success": true,
  "message": "Explanation retrieved successfully",
  "data": {
    "answer": "Markdown formatted explanation..."
  }
}
```

**Note:** `user_id` is automatically set from the authenticated user's ID.

---

### 2. POST `/api/ai/interaction`

General interaction/question answering.

**Request Body:**
```json
{
  "question": "How do lists work in Python?"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Answer retrieved successfully",
  "data": {
    "answer": "Markdown formatted answer..."
  }
}
```

**Note:** `user_id` is automatically set from the authenticated user's ID.

---

### 3. POST `/api/ai/assessment`

Generate assessment based on user input.

**Request Body:**
```json
{
  "assessment": "I want to learn about loops.",
  "difficulty": "intermediate"  // "beginner", "intermediate", or "pro"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assessment generated successfully",
  "data": {
    "answer": "Markdown formatted response with questions/hints..."
  }
}
```

**Note:** `user_id` is automatically set from the authenticated user's ID.

---

### 4. POST `/api/ai/assessment/topic`

Generate assessment questions from a topic.

**Request Body:**
```json
{
  "questions_prompt": "Python Decorators",
  "difficulty": "hard"  // "easy", "medium", "hard", or "very_hard"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assessment questions generated successfully",
  "data": {
    "success": true,
    "difficulty": "hard",
    "question_count": 10,
    "questions": [ ... ],
    "answers": { ... },
    "schemes": [ ... ]
  }
}
```

---

### 5. POST `/api/ai/assessment/pdf`

Generate assessment questions from PDF text.

**Request Body:**
```json
{
  "pdf_text": "Full text content extracted from PDF...",
  "difficulty": "medium"  // "easy", "medium", "hard", or "very_hard"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assessment questions generated successfully",
  "data": {
    "success": true,
    "difficulty": "medium",
    "question_count": 10,
    "questions": [
      {
        "ID": "1",
        "question_prompt": "Which of the following best describes...",
        "options": {
          "A": "Option A text",
          "B": "Option B text",
          "C": "Option C text",
          "D": "Option D text"
        }
      },
      ...
    ],
    "answers": {
      "1": "A",
      "2": "B",
      ...
    },
    "schemes": [
      {
        "ID": "1",
        "answers": {
          "A": {
            "isCorrect": true,
            "explanation": "Explanation text"
          },
          "B": {
            "isCorrect": false,
            "explanation": "Explanation text"
          },
          ...
        }
      },
      ...
    ]
  }
}
```

## Response Structure Details

### Questions Array
Each question object contains:
- `ID`: String identifier (e.g., "1", "2")
- `question_prompt`: The question text
- `options`: Object with keys A, B, C, D containing option text

### Answers Object
Maps question IDs to correct answer letters:
```json
{
  "1": "A",
  "2": "B",
  ...
}
```

### Schemes Array
Scoring schemes with explanations for each option:
- `ID`: Question ID
- `answers`: Object with A, B, C, D keys
  - Each contains `isCorrect` (boolean) and `explanation` (string)

## Configuration

Add to your `.env` file:

```bash
# AI Server Configuration
AI_SERVER_URL=https://endi-ai.onrender.com
AI_SERVER_TIMEOUT=30000  # Timeout in milliseconds (default: 30000 = 30 seconds)
```

## Example Usage

### Using cURL:

```bash
# Explain endpoint
curl -X POST http://localhost:8000/api/ai/explain \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What does this code do?",
    "code_snippet": "def hello(): print(\"Hello\")"
  }'

# Interaction endpoint
curl -X POST http://localhost:8000/api/ai/interaction \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do lists work in Python?"
  }'

# Assessment endpoint
curl -X POST http://localhost:8000/api/ai/assessment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assessment": "I want to learn about loops.",
    "difficulty": "intermediate"
  }'
```

### Using JavaScript/TypeScript:

```typescript
// Explain code
const response = await fetch('http://localhost:8000/api/ai/explain', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    question: 'What does this code do?',
    code_snippet: "print('Hello')",
  }),
});

const result = await response.json();
console.log(result.data.answer);
```

## Error Handling

All endpoints return standard error responses:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

Common error codes:
- `400` - Bad request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `500` - Internal server error or AI server error
- `504` - Gateway timeout (AI server timeout)

## Features

- ✅ Automatic user ID injection from authenticated user
- ✅ Request validation
- ✅ Error handling and logging
- ✅ Timeout protection (default 30 seconds)
- ✅ Swagger documentation
- ✅ Type-safe interfaces

## Notes

- All endpoints require authentication
- `user_id` is automatically extracted from the JWT token
- Requests are forwarded to the external AI server at `https://endi-ai.onrender.com/`
- Timeout is configurable via `AI_SERVER_TIMEOUT` environment variable
- All requests are logged for debugging

