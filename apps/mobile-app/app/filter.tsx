import { AuthWrapper } from "@/components/AuthWrapper";
import FiltersView from "@/components/Filter/Filter";
import React from "react";

const FilterScreen = () => {
  return (
    <AuthWrapper>
      <FiltersView />;
    </AuthWrapper>
  );
};

export default FilterScreen;
