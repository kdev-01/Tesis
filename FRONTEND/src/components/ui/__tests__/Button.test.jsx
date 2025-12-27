import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button.jsx';

describe('Button', () => {
  it('renders children and handles click', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Ingresar</Button>);
    const button = screen.getByRole('button', { name: /ingresar/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
