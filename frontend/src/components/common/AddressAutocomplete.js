import React, { useState, useEffect, useRef } from 'react';
import './AddressAutocomplete.css';

const AddressAutocomplete = ({ onAddressSelect }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [validated, setValidated] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (query.length < 4) { setSuggestions([]); setShowDropdown(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=us`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch (e) { setSuggestions([]); }
      setLoading(false);
    }, 500);
  }, [query]);

  const handleSelect = (place) => {
    const addr = place.address;
    const street = `${addr.house_number || ''} ${addr.road || addr.pedestrian || ''}`.trim();
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const state = addr.state || '';
    const zipCode = addr.postcode || '';
    const country = 'USA';
    setQuery(`${street}, ${city}, ${state} ${zipCode}`);
    setShowDropdown(false);
    setValidated(true);
    onAddressSelect({ street, city, state, zipCode, country });
  };

  return (
    <div className="address-autocomplete" ref={wrapperRef}>
      <div className="address-input-wrapper">
        <input
          type="text"
          placeholder="🔍 Start typing your US address..."
          value={query}
          onChange={e => { setQuery(e.target.value); setValidated(false); }}
          className={`address-input ${validated ? 'validated' : ''}`}
        />
        {loading && <span className="addr-spinner">⏳</span>}
        {validated && <span className="addr-check">✅</span>}
      </div>
      {showDropdown && suggestions.length > 0 && (
        <ul className="suggestions-dropdown">
          {suggestions.map((s, i) => (
            <li key={i} className="suggestion-item" onMouseDown={() => handleSelect(s)}>
              <span className="suggestion-icon">📍</span>
              <div>
                <p className="suggestion-main">
                  {`${s.address.house_number || ''} ${s.address.road || ''}`.trim() || s.display_name.split(',')[0]}
                </p>
                <p className="suggestion-sub">
                  {`${s.address.city || s.address.town || s.address.county || ''}, ${s.address.state || ''} ${s.address.postcode || ''}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
