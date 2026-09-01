#include <filesystem>
#include <fstream>
#include <iostream>
#include <system_error>

namespace fs = std::filesystem;

struct Cleanup {
    fs::path root;
    ~Cleanup() {
        std::error_code ignored;
        fs::remove_all(root, ignored);
    }
};

int main() {
    const fs::path root{"batch10-entry-refresh"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec || !fs::create_directories(root, ec) || ec) return 1;
    Cleanup cleanup{root};

    const fs::path file = root / "note.txt";
    {
        std::ofstream output{file};
        if (!output) return 2;
        output << 'a';
        output.close();
        if (!output) return 3;
    }

    fs::directory_entry entry{file, ec};
    if (ec) return 4;
    const auto before = entry.file_size(ec);
    if (ec) return 5;
    {
        std::ofstream output{file, std::ios::app};
        if (!output) return 6;
        output << 'b';
        output.close();
        if (!output) return 7;
    }
    entry.refresh(ec);
    if (ec) return 8;
    const auto after = entry.file_size(ec);
    if (ec) return 9;

    std::cout << "before=" << before << '\n';
    std::cout << "after=" << after << '\n';
}
