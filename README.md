# ConnectDev - Developer Booking Platform

A decentralized platform for connecting developers and clients, featuring real-time video consultations and blockchain-based smart contracts.

## Video

<iframe src="https://drive.google.com/file/d/1X27J-423wSwTopN-Aq53lI3ZC6M1BEcX/preview" width="640" height="480" allow="autoplay"></iframe>

## 🚀 Features

- Real-time video consultations using Agora SDK
- Smart contract integration with Ethereum
- Firebase authentication and database
- Modern React-based UI with Tailwind CSS
- TypeScript support for better development experience

## 🛠️ Tech Stack

- **Frontend**: React.js, TypeScript, Tailwind CSS
- **Smart Contracts**: Solidity, Hardhat
- **Video SDK**: Agora RTC
- **Backend Services**: Firebase
- **Web3**: Ethers.js, Web3.js
- **Development**: Vite, ESLint

## 🏗️ Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask or any Web3 wallet
- Git

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ConnectDev.git
cd ConnectDev
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example` and fill in your credentials:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

## 📝 Environment Variables

Make sure to set up the following environment variables in your `.env` file:
- `VITE_FIREBASE_CONFIG` - Firebase configuration
- `VITE_AGORA_APP_ID` - Agora App ID
- `VITE_CONTRACT_ADDRESS` - Deployed smart contract address
- Additional environment variables as specified in `.env.example`

## 🏃‍♂️ Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 📁 Project Structure

```
ConnectDev/
├── src/
│   ├── components/    # Reusable UI components
│   ├── contracts/     # Smart contract artifacts
│   ├── contexts/      # React context providers
│   ├── pages/         # Application pages
│   ├── services/      # API and service integrations
│   └── utils/         # Utility functions
├── public/            # Static assets
└── scripts/          # Deployment and utility scripts
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support, please open an issue in the GitHub repository or contact the maintainers.
