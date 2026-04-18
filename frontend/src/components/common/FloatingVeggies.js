import React from 'react';
import './FloatingVeggies.css';

const veggies = ['🥦', '🍅', '🥕', '🌽', '🥬', '🍎', '🥛', '🧅', '🫑', '🍋', '🥑', '🍇'];

const FloatingVeggies = () => (
  <div className="floating-veggies" aria-hidden="true">
    {veggies.map((v, i) => (
      <span key={i} className={`veggie veggie-${i + 1}`}
        style={{
          left: `${(i * 8.5) % 100}%`,
          animationDelay: `${i * 0.7}s`,
          animationDuration: `${8 + (i % 5) * 2}s`,
          fontSize: `${1.2 + (i % 3) * 0.4}rem`
        }}>
        {v}
      </span>
    ))}
  </div>
);

export default FloatingVeggies;
