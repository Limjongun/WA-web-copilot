# WA Web Copilot

WA Web Copilot is a Chrome extension designed to enhance the WhatsApp Web experience by integrating artificial intelligence. It seamlessly extracts chat context and generates context-aware, intelligent replies using the GitHub Models API.

## Features

- **Context-Aware Replies**: Analyzes ongoing conversations to provide relevant and coherent responses.
- **Draggable Floating Panel**: A non-intrusive, fully draggable user interface that overlays WhatsApp Web for easy access.
- **Persona Customization**: Configure the AI's tone and behavior by setting a custom persona to match your communication style.
- **Automated Text Injection**: Automatically pastes the generated reply into the WhatsApp input field and sends it with a single click.
- **Privacy-Focused Context Extraction**: Reads only the currently active chat thread on the screen.

## Architecture and Technology Stack

- **Framework**: React.js
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Extension Standard**: Chrome Manifest V3
- **AI Integration**: GitHub Models API (gpt-4o)

## Installation

To install and use this extension in developer mode, follow these steps:

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click on the **Load unpacked** button.
5. Select the `extension/dist` directory from the cloned repository.

Ensure that you have run the build process before loading the extension to generate the `dist` folder.

## Build Instructions

To build the extension from source, ensure you have Node.js installed, then run the following commands in the `extension` directory:

```bash
npm install
npm run build
```

## Configuration

The extension requires a valid GitHub Personal Access Token to authenticate with the GitHub Models API. This token must be provided in the application configuration to enable AI reply generation.

## License

This project is licensed under the MIT License.
