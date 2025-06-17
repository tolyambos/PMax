# Contributing to PMax

Thank you for your interest in contributing to PMax! This document provides guidelines and instructions for contributing to the project.

## Development Setup

Please refer to the [SETUP.md](SETUP.md) file for detailed instructions on setting up the development environment.

## Branching Strategy

We follow a feature branch workflow:

1. Create a new branch for each feature or bugfix from the `main` branch
2. Use descriptive names for branches, prefixed with the type of change:
   - `feature/` for new features
   - `fix/` for bug fixes
   - `refactor/` for code refactoring
   - `docs/` for documentation updates

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for code changes that neither fix bugs nor add features
- `docs:` for documentation changes
- `test:` for adding or updating tests
- `chore:` for changes to build processes or auxiliary tools

Example: `feat: add AI scene generation from text prompts`

## Pull Request Process

1. Update the README.md or documentation with details of changes, if appropriate
2. Update the CHANGELOG.md file with details of changes, if appropriate
3. Submit your pull request with a clear title and description
4. Ensure all CI checks pass
5. Request a review from at least one maintainer

## Code Style

- We follow the [Prettier](https://prettier.io/) and [ESLint](https://eslint.org/) configurations in the repository
- Run `npm run lint` before submitting your code
- TypeScript is preferred over JavaScript

## Testing

- Write unit tests for new features
- Ensure existing tests pass before submitting a PR
- Integration tests are encouraged for complex features

## Project Structure

Please maintain the existing project structure as described in the [SETUP.md](SETUP.md) file.

## License

By contributing to PMax, you agree that your contributions will be licensed under the project's license.

## Questions?

If you have any questions, please reach out to the maintainers through the project's communication channels.