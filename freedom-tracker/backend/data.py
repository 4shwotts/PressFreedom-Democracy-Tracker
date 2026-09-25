import pandas as pd  # For data manipulation and analysis

def load_and_merge():
    """
    Load, clean, and merge democracy and press freedom datasets from multiple possible file locations.

    This function attempts to locate and read the press freedom and democracy datasets from several
    common file paths. Once loaded, it cleans each dataset by selecting relevant columns, renaming
    them for consistency, and removing rows with missing values. The datasets are then merged on
    'Country' and 'Year' using an inner join to retain only overlapping records.

    Returns:
        pd.DataFrame: A cleaned and merged DataFrame containing 'Country', 'Year',
                      'DemocracyScore', and 'PressFreedomScore' columns.

    Raises:
        FileNotFoundError: If either the press freedom or democracy dataset cannot be found
                           in any of the expected file locations.
    """
    import os
    
    # Debug: List all files in current directory to help with troubleshooting
    print("Files in current directory:")
    for file in os.listdir('.'):
        print(f"  {file}")
    
    # Define possible file locations for press freedom data
    # This allows flexibility in where the data files are stored
    press_freedom_files = [
        "data/press_freedom_index.csv",    # In data subdirectory with .csv extension
        "data/press_freedom_index",        # In data subdirectory without extension
        "press_freedom_index.csv",         # In current directory with .csv extension
        "press_freedom_index"              # In current directory without extension
    ]
    
    # Define possible file locations for democracy data
    democracy_files = [
        "data/democracy_index.csv",        # In data subdirectory with .csv extension
        "data/democracy_index",            # In data subdirectory without extension
        "democracy_index.csv",             # In current directory with .csv extension
        "democracy_index"                  # In current directory without extension
    ]
    
    # Try to load press freedom data from various possible locations
    press_freedom = None
    for filename in press_freedom_files:
        try:
            press_freedom = pd.read_csv(filename)
            print(f"Successfully loaded press freedom data from: {filename}")
            break  # Exit loop once file is found and loaded
        except FileNotFoundError:
            continue  # Try next filename if current one doesn't exist
    
    # Check if press freedom data was successfully loaded
    if press_freedom is None:
        raise FileNotFoundError("Could not find press freedom data file. Tried: " + ", ".join(press_freedom_files))
    
    # Try to load democracy data from various possible locations
    democracy = None
    for filename in democracy_files:
        try:
            democracy = pd.read_csv(filename)
            print(f"Successfully loaded democracy data from: {filename}")
            break  # Exit loop once file is found and loaded
        except FileNotFoundError:
            continue  # Try next filename if current one doesn't exist
    
    # Check if democracy data was successfully loaded
    if democracy is None:
        raise FileNotFoundError("Could not find democracy data file. Tried: " + ", ".join(democracy_files))
    
    # Clean and standardise the press freedom dataset
    # Keep only the columns we need and rename them for consistency.
    # The country name is dropped here — the press freedom source renames countries
    # between years (e.g. 'Russian Federation' -> 'Russia', 'Turkey' -> 'Türkiye'),
    # so we join on the ISO code instead and take names from the democracy dataset
    press_freedom = press_freedom[['Year', 'ISO', 'Score']].rename(columns={'Score': 'PressFreedomScore'})

    # Clean and standardise the democracy dataset
    # Keep only the columns we need and rename them for consistency
    # Note: 'Entity' is renamed to 'Country' for consistency across datasets
    democracy = democracy[['Entity', 'ISO', 'Year', 'Democracy score']].rename(columns={
        'Entity': 'Country',
        'Democracy score': 'DemocracyScore'
    })

    # Remove rows with missing scores or ISO codes from both datasets
    # This ensures we only work with complete data. Rows without an ISO code are
    # blank separator rows (press freedom) or continent aggregates (democracy)
    press_freedom = press_freedom.dropna(subset=['PressFreedomScore', 'ISO', 'Year'])
    democracy = democracy.dropna(subset=['DemocracyScore', 'ISO'])

    # Year is read as float in the press freedom file because of its blank rows
    press_freedom['Year'] = press_freedom['Year'].astype(int)

    # Merge the two datasets on ISO code and Year
    # Using 'inner' join to keep only countries that appear in both datasets
    merged_df = pd.merge(
        democracy,
        press_freedom,
        on=['ISO', 'Year'],
        how='inner'  # Only keep countries with both democracy and press freedom data
    )
    
    # Final cleanup: remove any remaining rows with missing data
    # This is a safety measure in case merge introduced any NaN values
    merged_df = merged_df.dropna(subset=['DemocracyScore', 'PressFreedomScore'])

    # Sort the data by Country and Year for consistent ordering
    merged_df = merged_df.sort_values(['Country', 'Year']).reset_index(drop=True)
    return merged_df