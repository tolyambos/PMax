"use client";

import React from "react";
import { Input } from "./input";
import { Label } from "./label";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2 items-center">
        <div
          className="w-8 h-8 rounded-md border border-gray-300"
          style={{ backgroundColor: value }}
        />
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="p-0 w-12 h-8 cursor-pointer"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 h-8"
          placeholder="#FFFFFF"
        />
      </div>
    </div>
  );
}
