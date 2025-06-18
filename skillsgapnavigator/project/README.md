# Skills Gap Navigator

A web application to help users navigate their skills gap and find relevant learning resources.

## Features

- AI-powered skills gap analysis
- Personalized learning path recommendations
- Interactive UI with modern design
- Real-time progress tracking

## Tech Stack

- React + TypeScript
- Vite
- Google Gemini AI
- TailwindCSS
- React Router

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Google AI API key

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/playthegameoflife/skills-gap-navigator.git
cd skills-gap-navigator
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```env
VITE_GOOGLE_API_KEY=your_google_api_key_here
```

4. Start the development server:
```bash
npm run dev
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Deployment

### Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy!

### Environment Variables

Required environment variables:
- `VITE_GOOGLE_API_KEY` - Your Google AI API key

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
