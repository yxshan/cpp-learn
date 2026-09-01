#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <system_error>
#include <vector>

namespace fs = std::filesystem;

struct Cleanup {
    fs::path root;
    ~Cleanup() {
        std::error_code ignored;
        fs::remove_all(root, ignored);
    }
};

bool write_file(const fs::path& path) {
    std::ofstream output{path};
    if (!output) return false;
    output << "x";
    output.close();
    return static_cast<bool>(output);
}

int main() {
    const fs::path root{"batch10-iterator-level"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec || !fs::create_directories(root / "nested", ec) || ec) return 1;
    Cleanup cleanup{root};
    if (!write_file(root / "direct.txt") ||
        !write_file(root / "nested" / "inner.txt")) {
        return 2;
    }

    fs::directory_iterator iterator{root, ec};
    if (ec) return 3;
    const fs::directory_iterator end;
    std::vector<std::string> names;
    while (iterator != end) {
        names.push_back(iterator->path().filename().generic_string());
        iterator.increment(ec);
        if (ec) return 4;
    }
    std::sort(names.begin(), names.end());
    for (const std::string& name : names) {
        std::cout << name << '\n';
    }
    std::cout << "direct_entries=" << names.size() << '\n';
}
