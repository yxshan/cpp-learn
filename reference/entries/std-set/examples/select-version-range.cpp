#include <iostream>
#include <set>
#include <string>

int main() {
    const std::set<std::string> versions{"v1", "v2", "v3", "v4", "v5"};
    const auto first = versions.lower_bound("v2");
    const auto last = versions.upper_bound("v4");

    for (auto it = first; it != last; ++it) {
        std::cout << *it << (std::next(it) == last ? '\n' : ' ');
    }
}
