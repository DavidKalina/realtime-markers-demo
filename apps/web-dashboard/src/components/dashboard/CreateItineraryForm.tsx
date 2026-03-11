"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/contexts/ToastContext";
import {
  itineraryManagementService,
  type ItineraryItemPayload,
} from "@/services/itineraryManagement";
import { userManagementService } from "@/services/userManagement";
import type { User } from "@/services/userManagement";
import { Plus, Trash2, Wand2, Search, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ItineraryItemFormData {
  title: string;
  startTime: string;
  endTime: string;
  latitude: number | null;
  longitude: number | null;
  emoji: string;
  description: string;
  venueName: string;
  venueCategory: string;
}

interface CreateItineraryFormProps {
  onMapClickTarget: (index: number | null) => void;
  selectedItemIndex: number | null;
  items: ItineraryItemFormData[];
  setItems: React.Dispatch<React.SetStateAction<ItineraryItemFormData[]>>;
  debugCenter: { lat: number; lng: number } | null;
  setDebugCenter: React.Dispatch<
    React.SetStateAction<{ lat: number; lng: number } | null>
  >;
}

const emptyItem = (): ItineraryItemFormData => ({
  title: "",
  startTime: "",
  endTime: "",
  latitude: null,
  longitude: null,
  emoji: "",
  description: "",
  venueName: "",
  venueCategory: "",
});

export function CreateItineraryForm({
  onMapClickTarget,
  selectedItemIndex,
  items,
  setItems,
  setDebugCenter,
}: CreateItineraryFormProps) {
  const { success, error: showError } = useToast();

  // User search
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Itinerary fields
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [plannedDate, setPlannedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [durationHours, setDurationHours] = useState("4");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [activate, setActivate] = useState(true);

  // Debug generator
  const [debugCount, setDebugCount] = useState("5");
  const [debugLat, setDebugLat] = useState("");
  const [debugLng, setDebugLng] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced user search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!userSearch || userSearch.length < 2) {
      setUserResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const result = await userManagementService.getUsers({
        search: userSearch,
        limit: 5,
      });
      if (result.success && result.data) {
        setUserResults(result.data.users);
      }
      setIsSearching(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [userSearch]);

  const updateItem = useCallback(
    (index: number, field: keyof ItineraryItemFormData, value: any) => {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    [setItems],
  );

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (selectedItemIndex === index) {
      onMapClickTarget(null);
    }
  };

  const generateDebugStops = () => {
    const centerLat = parseFloat(debugLat);
    const centerLng = parseFloat(debugLng);
    const count = parseInt(debugCount) || 5;

    if (isNaN(centerLat) || isNaN(centerLng)) {
      showError("Enter valid center coordinates or click the map first");
      return;
    }

    setDebugCenter({ lat: centerLat, lng: centerLng });

    // Generate items scattered within ~75m of center
    const baseHour = 10;
    const newItems: ItineraryItemFormData[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count;
      // Random distance 20-70m (within 75m check-in radius)
      const distMeters = 20 + Math.random() * 50;
      const dLat = (distMeters * Math.cos(angle)) / 111320;
      const dLng =
        (distMeters * Math.sin(angle)) /
        (111320 * Math.cos((centerLat * Math.PI) / 180));

      const startHour = baseHour + i;
      const endHour = startHour + 1;

      newItems.push({
        title: `Debug Stop ${i + 1}`,
        startTime: `${String(startHour).padStart(2, "0")}:00`,
        endTime: `${String(endHour).padStart(2, "0")}:00`,
        latitude: centerLat + dLat,
        longitude: centerLng + dLng,
        emoji: ["☕", "🎵", "🍕", "📚", "🎨", "🏃", "🎮", "🌮"][i % 8],
        description: "",
        venueName: `Test Venue ${i + 1}`,
        venueCategory: "debug",
      });
    }

    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      showError("Select a user first");
      return;
    }
    if (!title || !city || !plannedDate || !durationHours) {
      showError("Fill in all required itinerary fields");
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.title &&
        item.startTime &&
        item.endTime &&
        item.latitude != null &&
        item.longitude != null,
    );

    if (validItems.length === 0) {
      showError("Add at least one item with coordinates");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      userId: selectedUser.id,
      title,
      city,
      plannedDate,
      durationHours: parseFloat(durationHours),
      activate,
      budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
      budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
      items: validItems.map(
        (item): ItineraryItemPayload => ({
          title: item.title,
          startTime: item.startTime,
          endTime: item.endTime,
          latitude: item.latitude!,
          longitude: item.longitude!,
          emoji: item.emoji || undefined,
          description: item.description || undefined,
          venueName: item.venueName || undefined,
          venueCategory: item.venueCategory || undefined,
        }),
      ),
    };

    const result = await itineraryManagementService.createItinerary(payload);

    if (result.success) {
      success(
        `Itinerary created${activate ? " and activated" : ""}! ${validItems.length} items.`,
      );
      // Reset form
      setTitle("");
      setCity("");
      setItems([emptyItem()]);
      setSelectedUser(null);
      setUserSearch("");
    } else {
      showError(result.error || "Failed to create itinerary");
    }

    setIsSubmitting(false);
  };

  return (
    <div
      className="space-y-6 overflow-y-auto pr-2"
      style={{ maxHeight: "calc(100vh - 200px)" }}
    >
      {/* User Picker */}
      <section className="space-y-2">
        <Label className="text-base font-semibold">User</Label>
        {selectedUser ? (
          <div className="flex items-center justify-between p-3 bg-secondary rounded-lg border">
            <div>
              <p className="font-medium">
                {selectedUser.displayName || selectedUser.email}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedUser.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedUser(null);
                setUserSearch("");
              }}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {isSearching && (
              <p className="text-xs text-muted-foreground px-1">Searching...</p>
            )}
            {userResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                {userResults.map((user) => (
                  <button
                    key={user.id}
                    className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors"
                    onClick={() => {
                      setSelectedUser(user);
                      setUserResults([]);
                      setUserSearch("");
                    }}
                  >
                    <p className="text-sm font-medium">
                      {user.displayName || "No name"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Itinerary Fields */}
      <section className="space-y-3">
        <Label className="text-base font-semibold">Itinerary Details</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Morning Coffee Trail"
            />
          </div>
          <div>
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="New York"
            />
          </div>
          <div>
            <Label htmlFor="plannedDate">Planned Date *</Label>
            <Input
              id="plannedDate"
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="durationHours">Duration (hours) *</Label>
            <Input
              id="durationHours"
              type="number"
              min="0.5"
              step="0.5"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="budgetMin">Budget Min</Label>
            <Input
              id="budgetMin"
              type="number"
              min="0"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="budgetMax">Budget Max</Label>
            <Input
              id="budgetMax"
              type="number"
              min="0"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              placeholder="100"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-1">
          <Checkbox
            id="activate"
            checked={activate}
            onCheckedChange={(checked) => setActivate(!!checked)}
          />
          <Label htmlFor="activate" className="text-sm">
            Activate itinerary for user after creation
          </Label>
        </div>
      </section>

      {/* Debug Stops Generator */}
      <section className="space-y-2 p-3 border border-dashed border-yellow-500/50 rounded-lg bg-yellow-500/5">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-yellow-500" />
          Generate Debug Stops
        </Label>
        <p className="text-xs text-muted-foreground">
          Scatter N items within 75m of a center point. Click the map to set
          center.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="debugLat" className="text-xs">
              Center Lat
            </Label>
            <Input
              id="debugLat"
              type="number"
              step="any"
              value={debugLat}
              onChange={(e) => setDebugLat(e.target.value)}
              placeholder="40.7128"
            />
          </div>
          <div>
            <Label htmlFor="debugLng" className="text-xs">
              Center Lng
            </Label>
            <Input
              id="debugLng"
              type="number"
              step="any"
              value={debugLng}
              onChange={(e) => setDebugLng(e.target.value)}
              placeholder="-74.006"
            />
          </div>
          <div>
            <Label htmlFor="debugCount" className="text-xs">
              Count
            </Label>
            <Input
              id="debugCount"
              type="number"
              min="1"
              max="20"
              value={debugCount}
              onChange={(e) => setDebugCount(e.target.value)}
            />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateDebugStops}
          className="w-full border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10"
        >
          <Wand2 className="h-3 w-3 mr-1" />
          Generate {debugCount} Debug Stops
        </Button>
      </section>

      {/* Items */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">
            Items ({items.length})
          </Label>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-3 w-3 mr-1" />
            Add Item
          </Button>
        </div>

        {items.map((item, index) => (
          <div
            key={index}
            className={`p-3 border rounded-lg space-y-2 transition-colors cursor-pointer ${
              selectedItemIndex === index
                ? "border-blue-500 bg-blue-500/5"
                : "border-border hover:border-muted-foreground"
            }`}
            onClick={() => onMapClickTarget(index)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                #{index + 1}
                {item.emoji && ` ${item.emoji}`}
              </span>
              <div className="flex items-center gap-1">
                {selectedItemIndex === index && (
                  <Check className="h-3 w-3 text-blue-500" />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(index);
                  }}
                  className="h-6 w-6 p-0 text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Input
                  placeholder="Item title"
                  value={item.title}
                  onChange={(e) => updateItem(index, "title", e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <Input
                type="time"
                value={item.startTime}
                onChange={(e) => updateItem(index, "startTime", e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <Input
                type="time"
                value={item.endTime}
                onChange={(e) => updateItem(index, "endTime", e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <Input
                placeholder="Lat"
                type="number"
                step="any"
                value={item.latitude ?? ""}
                onChange={(e) =>
                  updateItem(
                    index,
                    "latitude",
                    e.target.value ? parseFloat(e.target.value) : null,
                  )
                }
                onClick={(e) => e.stopPropagation()}
              />
              <Input
                placeholder="Lng"
                type="number"
                step="any"
                value={item.longitude ?? ""}
                onChange={(e) =>
                  updateItem(
                    index,
                    "longitude",
                    e.target.value ? parseFloat(e.target.value) : null,
                  )
                }
                onClick={(e) => e.stopPropagation()}
              />
              <Input
                placeholder="Emoji"
                value={item.emoji}
                onChange={(e) => updateItem(index, "emoji", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-20"
              />
              <Input
                placeholder="Venue name"
                value={item.venueName}
                onChange={(e) => updateItem(index, "venueName", e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <Input
                placeholder="Venue category"
                value={item.venueCategory}
                onChange={(e) =>
                  updateItem(index, "venueCategory", e.target.value)
                }
                onClick={(e) => e.stopPropagation()}
                className="col-span-2"
              />
            </div>
          </div>
        ))}
      </section>

      {/* Submit */}
      <Button
        className="w-full"
        size="lg"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating..." : "Create Itinerary"}
      </Button>
    </div>
  );
}
