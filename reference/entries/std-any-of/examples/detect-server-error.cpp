#include <algorithm>
#include <array>
#include <iostream>

int main() {
    const std::array<int, 4> page_statuses{200, 204, 502, 200};
    const bool has_incident = std::any_of(page_statuses.begin(), page_statuses.end(),
                                          [](int code) { return code >= 500; });

    std::cout << std::boolalpha << "page-incident=" << has_incident << '\n';
}
