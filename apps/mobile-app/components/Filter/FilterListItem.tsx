import React, { useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import {
  Calendar,
  Edit2,
  FilterIcon,
  MapPin,
  Check,
  SearchIcon,
  Trash2,
} from "lucide-react-native";
import { Filter as FilterType } from "../../services/ApiClient";
import { styles } from "./styles";

interface FilterListItemProps {
  item: FilterType;
  activeFilterIds: string[];
  onApply: (filter: FilterType) => void;
  onEdit: (filter: FilterType) => void;
  onDelete: (filterId: string) => void;
}

export const FilterListItem = React.memo<FilterListItemProps>(
  ({ item, activeFilterIds, onApply, onEdit, onDelete }) => {
    // Memoize date range calculation
    const getDateRangeText = useCallback(() => {
      if (!item.criteria.dateRange?.start || !item.criteria.dateRange?.end)
        return null;

      const start = new Date(item.criteria.dateRange.start);
      const end = new Date(item.criteria.dateRange.end);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) return "1d";
      if (diffDays < 7) return `${diffDays}d`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
      return `${Math.floor(diffDays / 30)}m`;
    }, [item.criteria.dateRange?.start, item.criteria.dateRange?.end]);

    return (
      <View style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <View style={styles.filterIconContainer}>
            {item.emoji ? (
              <Text style={styles.filterEmoji}>{item.emoji}</Text>
            ) : (
              <FilterIcon size={16} color="#93c5fd" />
            )}
          </View>

          <View style={styles.filterTitleContainer}>
            <Text style={styles.filterName}>{item.name}</Text>
            {item.semanticQuery && (
              <Text style={styles.filterQuery} numberOfLines={2}>
                {item.semanticQuery}
              </Text>
            )}
          </View>

          <View style={styles.filterDetails}>
            {/* Date Range */}
            {(item.criteria.dateRange?.start ||
              item.criteria.dateRange?.end) && (
              <View style={styles.filterDetailItem}>
                <Calendar size={10} color="#93c5fd" />
                <Text style={styles.filterDetailText}>
                  {getDateRangeText()}
                </Text>
              </View>
            )}

            {/* Location Criteria */}
            {item.criteria.location && (
              <View style={styles.filterDetailItem}>
                <MapPin size={10} color="#93c5fd" />
                <Text style={styles.filterDetailText}>
                  {item.criteria.location?.radius
                    ? (item.criteria.location.radius / 1000).toFixed(1)
                    : "0"}
                  km
                </Text>
              </View>
            )}

            {activeFilterIds.includes(item.id) && (
              <View style={styles.activeCheckmark}>
                <Check size={12} color="#40c057" />
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.filterActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.applyButton]}
            onPress={() => onApply(item)}
            activeOpacity={0.7}
          >
            <SearchIcon size={16} color="#93c5fd" />
            <Text style={[styles.actionButtonText, styles.applyButtonText]}>
              Apply
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => onEdit(item)}
            activeOpacity={0.7}
          >
            <Edit2 size={16} color="#f8f9fa" />
            <Text style={[styles.actionButtonText, styles.editButtonText]}>
              Edit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => onDelete(item.id)}
            activeOpacity={0.7}
          >
            <Trash2 size={16} color="#f97583" />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);
